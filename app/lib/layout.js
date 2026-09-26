// Shared page shell for the NOVA public application (server-rendered, no frontend framework).
const { esc } = require("./edge");

const CONSOLE_URL = "https://app.strikemap.space";
// Asset version changes on every deploy/restart so browsers and the Cloudflare edge fetch fresh CSS/JS.
const V = Date.now().toString(36);
const STAFF_URL = "https://tunnel.strikemap.space/secure";

const NAV = [
  ["/markets", "Markets"],
  ["/api", "API"],
  ["/status", "Status"],
];

function page({ title, active = "", body, description }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || "NOVA — a fictional Singapore digital-asset platform (demo environment). Cloudflare-protected, running on AWS EC2 ap-southeast-1.")}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/styles.css?v=${V}">
<script src="/app.js?v=${V}" defer></script>
</head>
<body>
<header class="nav">
  <div class="nav-in">
    <a class="brand" href="/" aria-label="NOVA home">
      <span class="mark" aria-hidden="true"></span>
      <span><b>NOVA</b><small>Digital Asset Platform</small></span>
    </a>
    <span class="demo-badge">Demo environment</span>
    <nav aria-label="Main">${NAV.map(([href, label]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
    <div class="nav-right">
      <span class="sys" data-live-status><i></i><span>System operational</span></span>
      <a class="ghost small" href="${CONSOLE_URL}" title="NOVA Edge Console (Cloudflare architecture demo)">Edge Console →</a>
      <a class="btn small" href="${STAFF_URL}" title="Staff sign-in through Cloudflare Access">Sign in</a>
    </div>
  </div>
</header>
<main>
${body}
</main>
<footer class="foot">
  <div class="foot-in">
    <div><b class="foot-brand">NOVA</b><p>Digital Asset Infrastructure<br>Singapore · Global Markets</p></div>
    <div><h4>Platform</h4><a href="/markets">Markets</a><a href="/api">API</a><a href="/status">Status</a><a href="/headers">Request Inspector</a></div>
    <div><h4>Infrastructure</h4><p>AWS · ap-southeast-1</p><h4>Security</h4><p>Cloudflare</p></div>
    <div><span class="demo-badge">Demo environment</span><p class="dim">NOVA is a fictional company created for a Cloudflare Solutions Engineering demo. No real trading, accounts or market data.</p><a class="ghost small" href="${CONSOLE_URL}">Edge Console →</a></div>
  </div>
</footer>
</body>
</html>`;
}

module.exports = { page, CONSOLE_URL, STAFF_URL };
