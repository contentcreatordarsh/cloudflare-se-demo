// Helpers for reading what Cloudflare (and cloudflared) tell the origin about a request.
const crypto = require("crypto");

const COLOS = {
  SIN: "Singapore", BKK: "Bangkok", HKG: "Hong Kong", NRT: "Tokyo", KIX: "Osaka", ICN: "Seoul", TPE: "Taipei",
  MNL: "Manila", CGK: "Jakarta", KUL: "Kuala Lumpur", SGN: "Ho Chi Minh City", BOM: "Mumbai", DEL: "New Delhi",
  MAA: "Chennai", BLR: "Bengaluru", SYD: "Sydney", MEL: "Melbourne", PER: "Perth", AKL: "Auckland", DXB: "Dubai",
  FRA: "Frankfurt", LHR: "London", AMS: "Amsterdam", CDG: "Paris", MAD: "Madrid", JNB: "Johannesburg",
  IAD: "Ashburn", EWR: "Newark", ORD: "Chicago", DFW: "Dallas", ATL: "Atlanta", MIA: "Miami", LAX: "Los Angeles",
  SJC: "San Jose", SEA: "Seattle", DEN: "Denver", YYZ: "Toronto", GRU: "São Paulo", MEX: "Mexico City",
};
const regions = new Intl.DisplayNames(["en"], { type: "region" });

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);

function edgeInfo(req) {
  const h = req.headers;
  const ray = h["cf-ray"] || null;
  const colo = ray && ray.includes("-") ? ray.split("-").pop().toUpperCase() : null;
  const cc = /^[A-Z]{2}$/i.test(h["cf-ipcountry"] || "") ? h["cf-ipcountry"].toUpperCase() : null;
  let country = null;
  try { country = cc && !["XX", "T1"].includes(cc) ? regions.of(cc) : null; } catch {}
  return {
    ray,
    colo,
    city: colo ? COLOS[colo] || colo : null,
    cc,
    country,
    flag: cc && !["XX", "T1"].includes(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐",
    originTls: h["x-origin-tls-protocol"] || null,
    viaTunnel: !!h["cf-warp-tag-id"],
    proxied: !!ray,
  };
}

// ---------- Cloudflare Access JWT verification (defence in depth on the origin) ----------
const TEAM = process.env.ACCESS_TEAM_DOMAIN || "https://hegdedarsh.cloudflareaccess.com";
const AUD = process.env.ACCESS_AUD || "c9e6bb79ff4d5877fded44aa9415133178bbfac706d5f62a504406d1fb10e5a6";
let jwks = { keys: [], at: 0 };

async function signingKey(kid) {
  let jwk = Date.now() - jwks.at < 600000 && jwks.keys.find((k) => k.kid === kid);
  if (!jwk) {
    const r = await fetch(`${TEAM}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(3000) });
    jwks = { keys: (await r.json()).keys || [], at: Date.now() };
    jwk = jwks.keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error("unknown signing key");
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

async function verifyAccessJwt(token) {
  const [h, p, s] = String(token || "").split(".");
  if (!h || !p || !s) throw new Error("missing Access token");
  const header = JSON.parse(Buffer.from(h, "base64url"));
  if (header.alg !== "RS256") throw new Error("unexpected alg");
  const ok = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), await signingKey(header.kid), Buffer.from(s, "base64url"));
  if (!ok) throw new Error("bad signature");
  const c = JSON.parse(Buffer.from(p, "base64url"));
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (c.iss !== TEAM || !aud.includes(AUD)) throw new Error("wrong issuer/audience");
  if (!c.exp || c.exp < Date.now() / 1000) throw new Error("token expired");
  return c;
}

// cloudflared exposes readiness (active connections to the Cloudflare edge) on its local metrics port.
async function tunnelStatus() {
  try {
    const j = await (await fetch("http://127.0.0.1:20241/ready", { signal: AbortSignal.timeout(1500) })).json();
    return { connected: Number(j.readyConnections) > 0, connections: Number(j.readyConnections) || 0, connector: j.connectorId || null };
  } catch {
    return { connected: false, connections: 0, connector: null };
  }
}

module.exports = { edgeInfo, esc, verifyAccessJwt, tunnelStatus };
