// Live market data from CoinMarketCap, cached on the NOVA origin.
//   Browser -> GET /api/market (NOVA) -> this cache -> CoinMarketCap quotes/latest
// The API key lives only in the server environment (COINMARKETCAP_API_KEY); the browser never sees it or talks to
// CoinMarketCap. Nothing here invents prices: if the upstream fails we keep serving the last real snapshot and mark it
// delayed; if we have never had one we serve no prices at all.
const fs = require("fs");
const path = require("path");

const ASSETS = [
  { id: 1, symbol: "BTC", name: "Bitcoin" },
  { id: 1027, symbol: "ETH", name: "Ethereum" },
  { id: 5426, symbol: "SOL", name: "Solana" },
  { id: 1839, symbol: "BNB", name: "BNB" },
  { id: 52, symbol: "XRP", name: "XRP" },
  { id: 2010, symbol: "ADA", name: "Cardano" },
];

const ENDPOINT = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest";
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const KEY = (process.env.COINMARKETCAP_API_KEY || "").trim();
const TTL = num(process.env.MARKET_TTL_SECONDS, 60) * 1000; // freshness while someone is watching
const BACKGROUND = num(process.env.MARKET_BACKGROUND_SECONDS, 900) * 1000; // keeps the 24h sparkline filled
const DAILY_CALLS = num(process.env.MARKET_DAILY_CALLS, 300); // Basic plan: 10k credits/month, 1 credit per call here
const STALE_AFTER = num(process.env.MARKET_STALE_SECONDS, 180) * 1000; // older than this is never shown as live
const HISTORY_FILE = process.env.MARKET_HISTORY_FILE || "";
const WINDOW = 24 * 3600 * 1000;
const SAMPLE_EVERY = 5 * 60 * 1000;
const SPARK_POINTS = 96;

let snapshot = null; // { fetchedAt, assets: [...] } — the last successful upstream response, normalised
let lastError = null; // { at, reason }
let inflight = null;
let lastAttempt = 0;
let calls = { day: "", n: 0 };
let history = loadHistory(); // symbol -> [[t, price], ...] sampled from our own successful fetches

function loadHistory() {
  if (!HISTORY_FILE) return {};
  try {
    const h = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    return h && typeof h === "object" ? h : {};
  } catch {
    return {};
  }
}

function saveHistory() {
  if (!HISTORY_FILE) return;
  const tmp = `${HISTORY_FILE}.tmp`;
  fs.promises
    .mkdir(path.dirname(HISTORY_FILE), { recursive: true })
    .then(() => fs.promises.writeFile(tmp, JSON.stringify(history)))
    .then(() => fs.promises.rename(tmp, HISTORY_FILE))
    .catch((e) => console.error(`market: history not saved (${e.code || e.message})`));
}

function record(now, assets) {
  let changed = false;
  for (const a of assets) {
    const h = (history[a.symbol] ||= []);
    if (!h.length || now - h[h.length - 1][0] >= SAMPLE_EVERY) {
      h.push([now, a.price]);
      changed = true;
    }
    while (h.length && now - h[0][0] > WINDOW) h.shift();
  }
  if (changed) saveHistory();
}

// Daily budget: on-demand refreshes always leave room for the background poller for the rest of the UTC day.
function withinBudget(kind) {
  const day = new Date().toISOString().slice(0, 10);
  if (calls.day !== day) calls = { day, n: 0 };
  const reserve = kind === "background" ? 0 : Math.ceil((Date.parse(day) + 86400000 - Date.now()) / BACKGROUND);
  return calls.n + reserve < DAILY_CALLS;
}

function refresh(kind = "demand") {
  if (inflight) return inflight;
  if (!KEY) {
    lastError = { at: Date.now(), reason: "not_configured" };
    return Promise.resolve();
  }
  if (kind === "demand" && Date.now() - lastAttempt < 15000) return Promise.resolve(); // no retry storms on failure
  if (!withinBudget(kind)) {
    if (snapshot && Date.now() - snapshot.fetchedAt > STALE_AFTER) lastError = { at: Date.now(), reason: "refresh_budget" };
    return Promise.resolve();
  }
  calls.n++;
  lastAttempt = Date.now();
  inflight = (async () => {
    try {
      const url = `${ENDPOINT}?id=${ASSETS.map((a) => a.id).join(",")}&convert=USD`;
      const r = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": KEY, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || (j.status && j.status.error_code)) {
        throw new Error(`HTTP ${r.status}${j?.status?.error_code ? ` code ${j.status.error_code}` : ""}${j?.status?.error_message ? `: ${j.status.error_message}` : ""}`);
      }
      const now = Date.now();
      const assets = ASSETS.map((a) => {
        const q = j.data?.[a.id]?.quote?.USD;
        if (!q || !Number.isFinite(q.price)) throw new Error(`missing quote for ${a.symbol}`);
        return {
          symbol: a.symbol,
          name: a.name,
          pair: `${a.symbol}/USDT`,
          price: q.price,
          change1h: Number.isFinite(q.percent_change_1h) ? q.percent_change_1h : null,
          change24h: Number.isFinite(q.percent_change_24h) ? q.percent_change_24h : null,
          volume24h: Number.isFinite(q.volume_24h) ? q.volume_24h : null,
          volumeChange24h: Number.isFinite(q.volume_change_24h) ? q.volume_change_24h : null,
          marketCap: Number.isFinite(q.market_cap) ? q.market_cap : null,
          updatedAt: q.last_updated || new Date(now).toISOString(),
        };
      });
      snapshot = { fetchedAt: now, assets };
      lastError = null;
      record(now, assets);
    } catch (e) {
      lastError = { at: Date.now(), reason: "upstream_error" };
      console.error(`market: CoinMarketCap refresh failed (${e.name === "TimeoutError" ? "timeout" : e.message})`);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// 24h sparkline from our own samples. Where the samples don't cover a point yet, CoinMarketCap's own
// percent_change_24h / percent_change_1h give the 24h-ago and 1h-ago prices (price / (1 + change/100)) — derived
// from the quote, never invented.
function sparkline(a, fetchedAt) {
  const pts = (history[a.symbol] || []).filter(([t]) => fetchedAt - t <= WINDOW).slice();
  if (!pts.length || pts[pts.length - 1][0] < fetchedAt) pts.push([fetchedAt, a.price]);
  const covered = (t) => pts.some(([pt]) => Math.abs(pt - t) < 30 * 60 * 1000);
  for (const [ago, chg] of [[WINDOW, a.change24h], [3600 * 1000, a.change1h]]) {
    if (chg !== null && chg !== undefined && !covered(fetchedAt - ago)) pts.push([fetchedAt - ago, a.price / (1 + chg / 100)]);
  }
  pts.sort((x, y) => x[0] - y[0]);
  if (pts.length <= SPARK_POINTS) return pts;
  const step = (pts.length - 1) / (SPARK_POINTS - 1);
  return Array.from({ length: SPARK_POINTS }, (_, i) => pts[Math.round(i * step)]);
}

// What the browser (and server-rendered pages) get: a small NOVA-shaped document, never the upstream payload.
function view() {
  const base = { source: "CoinMarketCap", attribution: "Market data powered by CoinMarketCap", currency: "USD", refreshSeconds: TTL / 1000 };
  if (!snapshot) return { ...base, status: "unavailable", reason: lastError?.reason || "starting", updatedAt: null, assets: [] };
  const age = Date.now() - snapshot.fetchedAt;
  const delayed = age > STALE_AFTER || (lastError && lastError.at > snapshot.fetchedAt);
  return {
    ...base,
    status: delayed ? "delayed" : "live",
    ...(delayed ? { reason: lastError?.reason || "stale" } : {}),
    updatedAt: new Date(snapshot.fetchedAt).toISOString(),
    assets: snapshot.assets.map((a) => ({ ...a, sparkline: sparkline(a, snapshot.fetchedAt) })),
  };
}

async function current() {
  if (!snapshot || Date.now() - snapshot.fetchedAt > TTL) await refresh("demand");
  return view();
}

const price = (symbol) => snapshot?.assets.find((a) => a.symbol === symbol) || null;

function start() {
  if (!KEY) {
    console.warn("market: COINMARKETCAP_API_KEY is not set — market data will show as unavailable");
    lastError = { at: Date.now(), reason: "not_configured" };
    return;
  }
  refresh("background");
  setInterval(() => refresh("background"), BACKGROUND).unref();
}

module.exports = { ASSETS, start, current, view, price };
