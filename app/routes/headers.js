const { Router } = require("express");
const { edgeInfo, esc } = require("../lib/edge");
const { page } = require("../lib/layout");

// GET /headers — every request header the origin received.
//   curl / API clients (Accept: */* or application/json) -> JSON, exactly what reached the origin
//   browsers (Accept: text/html)                         -> NOVA Request Inspector (raw headers one click away)
const router = Router();

const item = (k, v) => `<div class="kv"><small>${k}</small><span>${v}</span></div>`;

function inspector(req) {
  const e = edgeInfo(req);
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").toUpperCase();
  const left = [
    item("Request", `<span class="mono"><b class="method get">${esc(req.method)}</b> ${esc(req.path)}</span>`),
    item("Status", '<span class="ok">200 OK</span>'),
    item("Edge", e.proxied ? `${esc(e.city)} · <span class="mono">${esc(e.colo)}</span>` : "Direct (not proxied)"),
    item("TLS", `Full (strict)${e.originTls ? ` <span class="dim mono">${esc(e.originTls.replace("TLSv", "TLS "))} to origin</span>` : ""}`),
    item("Origin", "AWS EC2"),
    item("Region", '<span class="mono">ap-southeast-1</span>'),
  ].join("");
  const right = [
    item("Ray ID", `<span class="mono accent">${esc(e.ray || "—")}</span>`),
    item("Country", e.cc ? `${e.flag} ${esc(e.country || e.cc)}` : "—"),
    item("Protocol", esc(proto)),
    item("Proxy", e.proxied ? (e.viaTunnel ? "Cloudflare Tunnel" : "Cloudflare") : "None"),
    item("Origin", "NOVA EC2"),
  ].join("");
  return page({
    title: "Request Inspector · NOVA",
    body: `
<div class="wrap page">
  <p class="kicker">Request inspector</p>
  <h1 class="h1">See what reaches the NOVA origin.</h1>
  <p class="lede">This request has travelled through the Cloudflare edge before reaching AWS. Every value below is read from the request itself.</p>
  <div class="inspect">
    <section class="card"><h2 class="kicker">Request</h2>${left}</section>
    <section class="card cf"><h2 class="kicker">Cloudflare context</h2>${right}</section>
  </div>
  <ol class="path-line" aria-label="Request path">
    <li>Browser</li><li class="hl">Cloudflare</li><li>TLS</li><li>Security controls</li><li>AWS</li><li class="mono">Node.js /headers</li>
  </ol>
  <details class="card raw">
    <summary>View raw headers <span class="dim">${Object.keys(req.headers).length} headers · same JSON as <span class="mono">curl https://nova.strikemap.space/headers</span></span></summary>
    <pre class="mono">${esc(JSON.stringify(req.headers, null, 2))}</pre>
  </details>
</div>`,
  });
}

router.get("/headers", (req, res) => {
  const wantsHtml = req.query.format !== "json" && req.accepts(["application/json", "text/html"]) === "text/html";
  if (wantsHtml) return res.type("html").send(inspector(req));
  res.json(req.headers);
});

module.exports = router;
