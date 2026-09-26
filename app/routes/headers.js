const { Router } = require("express");
const { edgeInfo, esc } = require("../lib/edge");

// GET /headers — every request header the origin received.
//   curl / API clients (Accept: */* or application/json) -> JSON, exactly what reached the origin
//   browsers (Accept: text/html)                         -> NOVA Request Inspector page (raw JSON included)
const router = Router();

function page(req) {
  const e = edgeInfo(req);
  const raw = JSON.stringify(req.headers, null, 2);
  const rows = [
    ["Request", `<span class="mono">${esc(req.method)} ${esc(req.originalUrl.split("?")[0])}</span>`],
    ["Edge", e.proxied ? `${esc(e.city)} · <span class="mono">${esc(e.colo)}</span>` : "Not proxied (direct)"],
    ["TLS", `Full (strict)${e.originTls ? ` · <span class="mono">${esc(e.originTls.replace("TLSv", "TLS "))}</span> edge → origin` : ""}`],
    ["Cloudflare Ray ID", `<span class="mono accent">${esc(e.ray || "—")}</span>`],
    ["Country", e.cc ? `${e.flag} ${esc(e.country || e.cc)} <span class="mono dim">${esc(e.cc)}</span>` : "—"],
    ["Origin", "AWS EC2 · <span class=\"mono\">ap-southeast-1</span>"],
    ["Status", '<span class="ok">200 OK</span>'],
  ];
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Request Inspector · NOVA</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
</head><body>
<header class="bar"><a class="brand" href="/"><span class="mark"></span>NOVA</a><nav><a href="/headers" aria-current="page">Request Inspector</a><a href="https://tunnel.strikemap.space/secure">Staff Portal</a><a href="/healthz">System Health</a></nav></header>
<main class="wrap narrow">
  <p class="eyebrow">NOVA Request Inspector</p>
  <h1 class="h2">What reached the origin</h1>
  <p class="lede">This request travelled through Cloudflare to NOVA's origin on AWS EC2 in Singapore. Everything below is read from the request itself.</p>
  <section class="card inspector">
    ${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}
  </section>
  <details class="card raw">
    <summary>View raw headers <span class="dim">${Object.keys(req.headers).length} headers · also at <span class="mono">curl https://nova.strikemap.space/headers</span></span></summary>
    <pre class="mono">${esc(raw)}</pre>
  </details>
</main>
</body></html>`;
}

router.get("/headers", (req, res) => {
  const wantsHtml = req.query.format !== "json" && req.accepts(["application/json", "text/html"]) === "text/html";
  if (wantsHtml) return res.type("html").send(page(req));
  res.json(req.headers);
});

module.exports = router;
