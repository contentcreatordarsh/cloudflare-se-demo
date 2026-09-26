const { Router } = require("express");
const { edgeInfo, esc } = require("../lib/edge");
const { page, STAFF_URL } = require("../lib/layout");

// SIMULATED market data — illustrative values only, never live prices. app.js nudges them slightly for motion.
const MARKETS = [
  { pair: "BTC / USDT", symbol: "BTC-USDT", price: 108420.21, ccy: "$", change: 2.41 },
  { pair: "ETH / USDT", symbol: "ETH-USDT", price: 3921.44, ccy: "$", change: 1.82 },
  { pair: "SOL / USDT", symbol: "SOL-USDT", price: 214.82, ccy: "$", change: -0.34 },
  { pair: "BTC / SGD", symbol: "BTC-SGD", price: 139862.07, ccy: "S$", change: 1.91 },
];
const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const marketStrip = () => `
<section class="markets" aria-labelledby="mk">
  <div class="sec-head"><h2 id="mk" class="kicker">Markets</h2><span class="sim">Simulated market data</span></div>
  <div class="market-grid">
    ${MARKETS.map((m) => `
    <div class="market" data-market data-price="${m.price}" data-ccy="${m.ccy}">
      <span class="pair">${m.pair}</span>
      <span class="price num" data-price-out>${m.ccy}${fmt(m.price)}</span>
      <span class="chg num ${m.change >= 0 ? "up" : "down"}">${m.change >= 0 ? "+" : ""}${m.change.toFixed(2)}%</span>
    </div>`).join("")}
  </div>
</section>`;

const router = Router();

router.get("/", (req, res) => {
  res.send(page({
    title: "NOVA · Trade globally. Securely.",
    body: `
<section class="hero">
  <div class="wrap">
    <p class="kicker">Digital asset infrastructure<br><span>Singapore · Global markets</span></p>
    <h1>Trade globally.<br><em>Securely.</em></h1>
    <p class="lede">Institutional-grade digital asset infrastructure powered from Singapore and built for global markets.</p>
    <div class="cta"><a class="btn" href="/markets">View markets</a><a class="ghost" href="/api">API docs</a></div>
    <span class="demo-badge big">Demo environment</span>
  </div>
</section>
<div class="wrap">
  ${marketStrip()}
  <div class="two">
    <section class="card status-card" aria-labelledby="ps">
      <h2 id="ps" class="kicker">Platform status</h2>
      <ul class="svc">
        ${["API", "Orders", "Market data", "Account services"].map((s) => `<li><span>${s}</span><span class="op" data-op><i></i>Operational</span></li>`).join("")}
      </ul>
      <div class="meta"><div><small>Primary infrastructure</small>Singapore · ap-southeast-1</div><div><small>Environment</small>DEMO</div></div>
    </section>
    <section class="card arch" aria-labelledby="bg">
      <h2 id="bg" class="kicker">Built for global traffic</h2>
      <ol class="flow">
        <li>Users</li><li class="hl">Cloudflare Edge</li><li>NOVA API</li><li>AWS Singapore</li>
      </ol>
      <div class="chips"><span>DNS</span><span>TLS</span><span>Security</span><span>Rate limiting</span></div>
      <a class="ghost" href="/api">Explore API →</a>
    </section>
  </div>
</div>`,
  }));
});

router.get("/markets", (req, res) => {
  res.send(page({
    title: "Markets · NOVA",
    active: "/markets",
    body: `
<div class="wrap page">
  <p class="kicker">Markets</p>
  <h1 class="h1">Global digital asset markets</h1>
  <p class="lede">Illustrative pairs served from NOVA's Singapore infrastructure. Prices on this page are simulated.</p>
  ${marketStrip()}
  <section class="card order" aria-labelledby="do">
    <div class="order-grid">
      <form id="order-form" class="order-form" novalidate>
        <h2 id="do" class="kicker">Demo order</h2>
        <label>Symbol<select name="symbol">${MARKETS.map((m) => `<option>${m.symbol}</option>`).join("")}</select></label>
        <label>Side<select name="side"><option value="buy">BUY</option><option value="sell">SELL</option></select></label>
        <label>Quantity<input name="quantity" type="number" min="0.0001" max="1000" step="0.0001" value="0.01" inputmode="decimal"></label>
        <button class="btn" type="submit">Submit demo order</button>
        <p class="warn-note">Demo — no real trade executed. <span class="dim">POST /api/orders is rate limited at the Cloudflare edge (5 per 10 s).</span></p>
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
    ["GET", "/headers", "Inspect the request received by the origin — including what Cloudflare added.", `curl ${base}/headers`],
    ["GET", "/healthz", "Check origin health.", `curl ${base}/healthz`],
    ["POST", "/api/orders", "Submit a demo order. Rate limited at the edge: 5 requests per 10 seconds.", `curl -X POST ${base}/api/orders -H "Content-Type: application/json" -d '{"symbol":"BTC-USDT","side":"buy","quantity":0.01}'`],
  ];
  const loop = `for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\\n" -X POST ${base}/api/orders -H "Content-Type: application/json" -d '{"symbol":"BTC-USDT","side":"buy","quantity":0.01}'; done`;
  res.send(page({
    title: "API · NOVA",
    active: "/api",
    body: `
<div class="wrap page">
  <p class="kicker">NOVA API</p>
  <h1 class="h1">A deliberately small API</h1>
  <div class="api-meta"><div><small>Base URL</small><span class="mono">${base}</span></div><div><small>Authentication</small>Demo only</div><div><small>Environment</small>DEMO</div></div>
  <section class="endpoints">
    ${eps.map(([m, p, d, c]) => `
    <article class="card ep">
      <div class="ep-head"><span class="method ${m.toLowerCase()}">${m}</span><span class="mono path">${p}</span>${m === "GET" ? `<a class="ghost small" href="${p}">Open →</a>` : `<a class="ghost small" href="/markets">Try in UI →</a>`}</div>
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

router.get("/status", (req, res) => {
  const e = edgeInfo(req);
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
      <li><span>Orders</span><span class="op" data-op><i></i>Operational</span></li>
      <li><span>Origin</span><span class="op" data-op><i></i>Healthy</span></li>
    </ul>
    <div class="meta three"><div><small>Region</small>Singapore</div><div><small>AWS</small>ap-southeast-1</div><div><small>Environment</small>DEMO</div></div>
  </section>
  <p class="dim small-note">Live from <a href="/healthz" class="mono">/healthz</a>, refreshed every 15 s${e.ray ? ` · served through Cloudflare ${esc(e.city)} · Ray <span class="mono">${esc(e.ray)}</span>` : ""}. Staff: <a href="${STAFF_URL}">private portal</a>.</p>
</div>`,
  }));
});

module.exports = router;
