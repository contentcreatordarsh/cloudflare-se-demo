const { Router } = require("express");
const { edgeInfo, esc } = require("../lib/edge");
const { page, STAFF_URL, CONSOLE_URL } = require("../lib/layout");
const market = require("../lib/market");
const { ICONS, fmtPrice, fmtChange, fmtBig, fmtTime, dir, sparkPath, statusPill, DASH } = require("../lib/coins");

// Every price on these pages comes from lib/market.js (CoinMarketCap, cached on the origin). Pages render whatever
// the cache holds right now — never a hard-coded or generated value — and public/app.js keeps them updated.
const SW = 120, SH = 36; // sparkline box
const spark = (a, cls = "spark") => {
  const d = a ? sparkPath(a.sparkline, SW, SH) : "";
  return `<svg class="${cls} ${a ? dir(a.change24h) : ""}" viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" aria-hidden="true"><path class="area" data-spark-area d="${d ? `${d}L${SW - 2} ${SH}L2 ${SH}Z` : ""}"/><path class="line" data-spark d="${d}"/></svg>`;
};
const updated = (m) => `<span class="mkt-upd" data-mkt-updated>${m.updatedAt ? `Updated ${fmtTime(m.updatedAt)}` : "Waiting for market data"}</span>`;
const attribution = `<span class="attr">Market data powered by <b>CoinMarketCap</b></span>`;
const bySymbol = (m) => Object.fromEntries(m.assets.map((a) => [a.symbol, a]));

function tickerCards(m) {
  const A = bySymbol(m);
  return market.ASSETS.map(({ symbol, name }) => {
    const a = A[symbol];
    return `
    <a class="tick" href="/markets#asset-${symbol}" data-asset="${symbol}" aria-label="${name} market">
      <span class="t-top"><span class="ic">${ICONS[symbol]}</span><span class="t-pair"><b>${symbol}</b> / USDT</span><span class="t-chg num ${a ? dir(a.change24h) : ""}" data-chg>${a ? fmtChange(a.change24h) : DASH}</span></span>
      <span class="t-price num" data-price>${a ? fmtPrice(a.price) : DASH}</span>
      ${spark(a)}
      <span class="t-upd" data-upd>${a ? fmtTime(a.updatedAt) : DASH}</span>
    </a>`;
  }).join("");
}

function volumeCard(m) {
  const vols = m.assets.filter((a) => Number.isFinite(a.volume24h));
  const total = vols.reduce((s, a) => s + a.volume24h, 0);
  const prev = vols.reduce((s, a) => s + (Number.isFinite(a.volumeChange24h) ? a.volume24h / (1 + a.volumeChange24h / 100) : a.volume24h), 0);
  const chg = total && prev ? (total / prev - 1) * 100 : null;
  const max = Math.max(1, ...vols.map((a) => a.volume24h));
  // Bars are SVG attributes (the CSP forbids inline style attributes); public/app.js resizes them on refresh.
  const bars = market.ASSETS.map(({ symbol }, i) => {
    const a = bySymbol(m)[symbol];
    const hgt = a && Number.isFinite(a.volume24h) ? Math.max(2, (a.volume24h / max) * 56) : 2;
    return `<rect data-bar="${symbol}" x="${i * 40 + 8}" y="${(60 - hgt).toFixed(1)}" width="24" height="${hgt.toFixed(1)}" rx="3"/>`;
  }).join("");
  return `
  <aside class="vol-card" data-vol-card aria-label="Market-wide 24 hour volume for the tracked assets">
    <p class="vc-k">24h market volume</p>
    <p class="vc-v"><b class="num" data-vol-total>${vols.length ? fmtBig(total) : DASH}</b><span class="chg num ${dir(chg)}" data-vol-chg>${Number.isFinite(chg) ? fmtChange(chg) : ""}</span></p>
    <svg class="vc-bars" viewBox="0 0 240 60" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>
    <div class="vc-labels">${market.ASSETS.map(({ symbol }) => `<small>${symbol}</small>`).join("")}</div>
    <p class="vc-note">Across BTC, ETH, SOL, BNB, XRP and ADA on all markets · CoinMarketCap. Not NOVA volume.</p>
  </aside>`;
}

// Stylised Singapore waterfront — decorative backdrop for the platform section.
const SKYLINE = `<svg class="skyline" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080a0d" stop-opacity="0"/><stop offset=".55" stop-color="#2a1506" stop-opacity=".6"/><stop offset=".84" stop-color="#f6821f" stop-opacity=".28"/><stop offset=".85" stop-color="#07080b"/><stop offset="1" stop-color="#050608"/></linearGradient></defs>
<rect width="1440" height="200" fill="url(#sky)"/>
<g fill="#0c0e12">
<path d="M0 170v-34h18v-10h22v44zm46 0v-58h16v58zm22 0v-26h14v26zm20 0v-70h20v70zm26 0v-40h14v40zm20 0v-88h18v88zm24 0v-54h16v54zm22 0v-100h18v100zm24 0v-62h16v62zm22 0v-38h22v38zm28 0v-24h18v24z"/>
<path d="M430 170v-20h40v20zm48 0v-34h16v34zm22 0v-14h44v14zm50 0v-28h14v28z"/>
<path d="M872 170l6-98h26l2 98zm58 0l6-98h26l2 98zm58 0l6-98h26l2 98z"/>
<path d="M858 72c56-8 146-9 196-3l3 6c-58-4-140-3-199 3z"/>
<path d="M1110 170v-36h18v36zm24 0v-58h14v58zm20 0v-30h24v30zm30 0v-74h16v74zm22 0v-46h16v46zm22 0v-26h20v26zm26 0v-64h14v64zm20 0v-40h24v40zm30 0v-22h40v22zm46 0v-50h14v50zm20 0v-30h30v30z"/>
</g>
<g fill="#ffb366" opacity=".5"><rect x="150" y="96" width="2" height="2"/><rect x="158" y="118" width="2" height="2"/><rect x="200" y="82" width="2" height="2"/><rect x="206" y="104" width="2" height="2"/><rect x="884" y="96" width="2" height="2"/><rect x="942" y="112" width="2" height="2"/><rect x="1004" y="90" width="2" height="2"/><rect x="1190" y="110" width="2" height="2"/><rect x="1262" y="120" width="2" height="2"/></g>
<g stroke="#f6821f" stroke-opacity=".2" stroke-width="1.5"><path d="M874 178h30M932 184h30M990 178h30M150 182h40M1180 180h36"/></g>
</svg>`;

const FEATS = [
  ["shield", "Institutional<br>security"],
  ["pulse", "Live market<br>data"],
  ["globe", "Global<br>access"],
  ["layers", "Built for<br>developers"],
];
const GLYPH = {
  shield: `<path d="M12 3 5 6v5c0 4.4 3 8.4 7 9.6 4-1.2 7-5.2 7-9.6V6z"/>`,
  pulse: `<path d="M3 12h4l2-6 4 12 2-6h6"/>`,
  globe: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>`,
  layers: `<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>`,
  chart: `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
  code: `<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>`,
  lock: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
};
const glyph = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[k]}</svg>`;

const router = Router();

router.get("/", async (req, res) => {
  const m = await market.current();
  const btc = bySymbol(m).BTC;
  res.send(page({
    title: "NOVA · Trade globally. Securely.",
    body: `
<section class="hero2">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="kicker">Global markets. <span>Trusted infrastructure.</span></p>
      <h1>Trade globally.<br><em>Securely.</em></h1>
      <p class="lede">Institutional-grade digital asset infrastructure powered from Singapore and built for global markets.</p>
      <div class="cta"><a class="btn" href="/markets#trade">Start trading <span aria-hidden="true">→</span></a><a class="ghost" href="#markets">View markets</a></div>
      <p class="demo-strip"><b>Demo environment</b><span>Live prices · no real trades executed</span></p>
      <ul class="feats">${FEATS.map(([k, t]) => `<li>${glyph(k)}<span>${t}</span></li>`).join("")}</ul>
    </div>
    <div class="hero-visual">
      <div class="globe" data-globe><canvas aria-hidden="true"></canvas></div>
      ${volumeCard(m)}
    </div>
  </div>
</section>

<section id="markets" class="ticker-sec" aria-labelledby="lmd">
  <div class="wrap">
    <div class="ticker-head">
      <h2 id="lmd" class="kicker">Live market data</h2>${statusPill(m)}${updated(m)}
      <span class="spacer"></span>${attribution}<a class="view-all" href="/markets">View all markets <span aria-hidden="true">→</span></a>
    </div>
    <div class="ticker" data-ticker>${tickerCards(m)}</div>
  </div>
</section>

<section class="platform" aria-labelledby="plat">
  ${SKYLINE}
  <div class="wrap plat-grid">
    <div class="phone-wrap">
      <div class="phone" data-asset="BTC" aria-label="NOVA mobile preview with live BTC price (demo)">
        <div class="ph-notch"></div>
        <div class="ph-bar"><span class="num">9:41</span><span class="ph-sig"><i></i><i></i><i></i></span></div>
        <div class="ph-top"><span aria-hidden="true">‹</span><span class="ph-brand"><span class="mark sm"></span>NOVA</span><span aria-hidden="true">⋯</span></div>
        <div class="ph-pair"><span class="ic">${ICONS.BTC}</span><b>BTC</b> / USDT</div>
        <div class="ph-price num" data-price>${btc ? fmtPrice(btc.price) : DASH}</div>
        <div class="ph-chg num ${btc ? dir(btc.change24h) : ""}" data-chg>${btc ? fmtChange(btc.change24h) : DASH}</div>
        ${spark(btc, "spark ph-chart")}
        <div class="ph-range"><span class="on">24H</span><span>CoinMarketCap</span></div>
        <div class="ph-actions"><span class="ph-buy">Buy</span><span class="ph-sell">Sell</span></div>
        <p class="ph-demo">Demo · no real trades</p>
      </div>
    </div>
    <div class="plat-copy">
      <p class="kicker">Built for a global digital economy</p>
      <h2 id="plat">A complete platform for the <em>next generation of finance.</em></h2>
      <p class="lede">Live reference prices, a developer API and private staff tools, delivered from Singapore through Cloudflare's global network. Trading on this site is simulated.</p>
      <div class="feat-cards">
        <a class="fcard" href="/markets#trade">${glyph("chart")}<h3>Spot trading <span class="sim">Demo</span></h3><p>Simulated orders against live reference prices. No real trades are executed.</p></a>
        <a class="fcard" href="${STAFF_URL}">${glyph("layers")}<h3>Private operations</h3><p>Staff tools behind Cloudflare Access and Tunnel. No public path to the origin.</p></a>
        <a class="fcard" href="/api">${glyph("code")}<h3>Developer API</h3><p>A small, documented REST API, rate limited at the Cloudflare edge.</p></a>
        <a class="fcard" href="/headers">${glyph("lock")}<h3>Security first</h3><p>Full (strict) TLS, WAF and rate limiting before traffic reaches AWS.</p></a>
      </div>
    </div>
  </div>
</section>

<div class="wrap">
  <div class="two">
    <section class="card status-card" aria-labelledby="ps">
      <h2 id="ps" class="kicker">Platform status</h2>
      <ul class="svc">
        ${["API", "Orders"].map((s) => `<li><span>${s}</span><span class="op" data-op><i></i>Operational</span></li>`).join("")}
        <li><span>Market data <small class="dim">CoinMarketCap</small></span><span class="op" data-mkt-op><i></i>${m.status === "live" ? "Live" : m.status === "delayed" ? "Delayed" : "Unavailable"}</span></li>
      </ul>
      <div class="meta"><div><small>Primary infrastructure</small>Singapore · ap-southeast-1</div><div><small>Environment</small>DEMO</div></div>
    </section>
    <section id="security" class="card arch" aria-labelledby="bg">
      <h2 id="bg" class="kicker">Security &amp; delivery</h2>
      <ol class="flow">
        <li>Users</li><li class="hl">Cloudflare Edge</li><li>NOVA API</li><li>AWS Singapore</li>
      </ol>
      <div class="chips"><span>DNS</span><span>TLS</span><span>WAF</span><span>Rate limiting</span><span>Access</span></div>
      <a class="ghost" href="${CONSOLE_URL}">See it in the Edge Console →</a>
    </section>
  </div>
</div>`,
  }));
});

router.get("/markets", async (req, res) => {
  const m = await market.current();
  const A = bySymbol(m);
  res.send(page({
    title: "Markets · NOVA",
    active: "/markets",
    body: `
<div class="wrap page">
  <p class="kicker">Markets</p>
  <h1 class="h1">Global digital asset markets</h1>
  <p class="lede">Live reference prices for six major assets, served from NOVA's Singapore origin and refreshed from CoinMarketCap.</p>
  <div class="demo-banner" role="note"><b>Demo environment · No real trades executed</b><span>Prices are real market data from CoinMarketCap. Orders on this page are simulated and never executed.</span></div>

  <section class="card mkt-card" aria-labelledby="lm">
    <div class="ticker-head"><h2 id="lm" class="kicker">Live market data</h2>${statusPill(m)}${updated(m)}<span class="spacer"></span>${attribution}</div>
    <div class="table-scroll">
      <table class="mkt-table">
        <thead><tr><th>Asset</th><th class="r">Price (USD)</th><th class="r">24h</th><th class="r">24h volume</th><th class="r">Market cap</th><th>Last 24h</th><th class="r">Updated</th></tr></thead>
        <tbody>
        ${market.ASSETS.map(({ symbol, name }) => {
          const a = A[symbol];
          return `<tr id="asset-${symbol}" data-asset="${symbol}">
            <td><span class="asset"><span class="ic">${ICONS[symbol]}</span><span><b>${symbol}</b> / USDT<small>${name}</small></span></span></td>
            <td class="r num strong" data-price>${a ? fmtPrice(a.price) : DASH}</td>
            <td class="r num ${a ? dir(a.change24h) : ""}" data-chg>${a ? fmtChange(a.change24h) : DASH}</td>
            <td class="r num" data-vol>${a ? fmtBig(a.volume24h) : DASH}</td>
            <td class="r num" data-cap>${a ? fmtBig(a.marketCap) : DASH}</td>
            <td>${spark(a)}</td>
            <td class="r mono dim" data-upd>${a ? fmtTime(a.updatedAt) : DASH}</td>
          </tr>`;
        }).join("")}
        </tbody>
      </table>
    </div>
  </section>

  <section id="trade" class="card order" aria-labelledby="do">
    <div class="order-grid">
      <form id="order-form" class="order-form" novalidate>
        <h2 id="do" class="kicker">Demo order</h2>
        <label>Market<select name="symbol">${market.ASSETS.map(({ symbol }) => `<option value="${symbol}-USDT">${symbol} / USDT</option>`).join("")}</select></label>
        <label>Side<select name="side"><option value="buy">BUY</option><option value="sell">SELL</option></select></label>
        <label>Quantity<input name="quantity" type="number" min="0.0001" max="1000" step="0.0001" value="0.01" inputmode="decimal"></label>
        <div class="ref"><div><small>Reference price</small><span class="num" data-ref-price>${A.BTC ? fmtPrice(A.BTC.price) : DASH}</span></div><div><small>Est. value</small><span class="num" data-ref-value>${A.BTC ? fmtPrice(A.BTC.price * 0.01) : DASH}</span></div></div>
        <button class="btn" type="submit">Submit demo order</button>
        <p class="warn-note">Demo · no real trade is executed. <span class="dim">POST /api/orders is rate limited at the Cloudflare edge (5 per 10 s).</span></p>
      </form>
      <div id="order-result" class="order-result" aria-live="polite">
        <p class="dim">Submit a demo order to see the origin's response. Submit six in ten seconds to see Cloudflare's rate limit.</p>
      </div>
    </div>
  </section>
</div>`,
  }));
});

router.get("/api", (req, res) => {
  const base = "https://nova.strikemap.space";
  const eps = [
    ["GET", "/api/market", "Live reference prices for BTC, ETH, SOL, BNB, XRP and ADA: price, 24h change, 24h sparkline. Cached on the NOVA origin from CoinMarketCap; the upstream API key never leaves the server.", `curl ${base}/api/market`],
    ["GET", "/headers", "Inspect the request received by the origin, including what Cloudflare added.", `curl ${base}/headers`],
    ["GET", "/healthz", "Check origin health.", `curl ${base}/healthz`],
    ["POST", "/api/orders", "Submit a demo order (never executed). Rate limited at the edge: 5 requests per 10 seconds.", `curl -X POST ${base}/api/orders -H "Content-Type: application/json" -d '{"symbol":"BTC-USDT","side":"buy","quantity":0.01}'`],
  ];
  const loop = `for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\\n" -X POST ${base}/api/orders -H "Content-Type: application/json" -d '{"symbol":"BTC-USDT","side":"buy","quantity":0.01}'; done`;
  res.send(page({
    title: "API · NOVA",
    active: "/api",
    body: `
<div class="wrap page">
  <p class="kicker">NOVA API</p>
  <h1 class="h1">A deliberately small API</h1>
  <div class="api-meta"><div><small>Base URL</small><span class="mono">${base}</span></div><div><small>Authentication</small>Demo only</div><div><small>Market data</small>CoinMarketCap</div><div><small>Environment</small>DEMO</div></div>
  <section class="endpoints">
    ${eps.map(([m, p, d, c]) => `
    <article class="card ep">
      <div class="ep-head"><span class="method ${m.toLowerCase()}">${m}</span><span class="mono path">${p}</span>${m === "GET" ? `<a class="ghost small" href="${p}">Open →</a>` : `<a class="ghost small" href="/markets#trade">Try in UI →</a>`}</div>
      <p>${d}</p>
      <div class="code"><code>${esc(c)}</code><button class="copy" data-copy="${esc(c)}" aria-label="Copy command">Copy</button></div>
    </article>`).join("")}
  </section>
  <section class="card ep">
    <div class="ep-head"><span class="method post">POST</span><span class="mono path">/api/orders</span><span class="sim">Rate-limit demo</span></div>
    <p>Send ten orders in a row. The first five reach the NOVA origin (<b class="ok">200</b>); the rest are rejected at the Cloudflare edge (<b class="bad">429</b>) before they reach Node.js.</p>
    <div class="code"><code>${esc(loop)}</code><button class="copy" data-copy="${esc(loop)}" aria-label="Copy command">Copy</button></div>
  </section>
</div>`,
  }));
});

router.get("/status", async (req, res) => {
  const e = edgeInfo(req);
  const m = market.view();
  res.send(page({
    title: "Status · NOVA",
    active: "/status",
    body: `
<div class="wrap page narrow">
  <p class="kicker">NOVA status</p>
  <h1 class="h1 status-h" data-all-status><i></i>All systems operational</h1>
  <section class="card">
    <ul class="svc big">
      <li><span>API</span><span class="op" data-op><i></i>Operational</span></li>
      <li><span>Orders <small class="dim">demo, not executed</small></span><span class="op" data-op><i></i>Operational</span></li>
      <li><span>Origin</span><span class="op" data-op><i></i>Healthy</span></li>
      <li><span>Market data <small class="dim">CoinMarketCap</small></span><span class="op" data-mkt-op><i></i>${m.status === "live" ? "Live" : m.status === "delayed" ? "Delayed" : "Unavailable"}</span></li>
    </ul>
    <div class="meta three"><div><small>Region</small>Singapore</div><div><small>AWS</small>ap-southeast-1</div><div><small>Environment</small>DEMO</div></div>
  </section>
  <p class="dim small-note">Live from <a href="/healthz" class="mono">/healthz</a> and <a href="/api/market" class="mono">/api/market</a>, refreshed every 15–30 s${e.ray ? ` · served through Cloudflare ${esc(e.city)} · Ray <span class="mono">${esc(e.ray)}</span>` : ""}. Staff: <a href="${STAFF_URL}">private portal</a>.</p>
</div>`,
  }));
});

module.exports = router;
