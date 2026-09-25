// SiamPay Request Inspector — origin web server.
// Zero dependencies. Listens on 127.0.0.1 only; Nginx (TLS) and cloudflared sit in front.
const http = require("http");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";

const escapeHtml = (v) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

// Headers Cloudflare adds or rewrites on the way to the origin — highlighted in the UI.
const CF_HEADERS = new Set([
  "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "cdn-loop",
  "x-forwarded-for", "x-forwarded-proto", "x-real-ip", "true-client-ip",
  "cf-warp-tag-id", "cf-access-jwt-assertion", "cf-access-authenticated-user-email",
]);

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { --bg:#0f1115; --card:#181b22; --line:#2a2f3a; --fg:#e8eaf0; --muted:#9aa3b2; --accent:#f6821f; --ok:#3fb950; --bad:#f85149; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--fg); }
  .wrap { max-width:1040px; margin:0 auto; padding:40px 16px; }
  h1 { margin:0 0 4px; font-size:28px; } h2 { margin:0 0 8px; font-size:18px; }
  .sub { color:var(--muted); margin:0 0 28px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px; }
  .card p { color:var(--muted); margin:0 0 12px; }
  a { color:var(--accent); } code { background:#232733; padding:2px 6px; border-radius:4px; font-size:13px; }
  button { background:var(--accent); color:#111; border:0; border-radius:8px; padding:10px 14px; font-weight:600; cursor:pointer; }
  table { width:100%; border-collapse:collapse; margin-top:12px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; word-break:break-all; }
  th { color:var(--muted); font-weight:600; }
  tr.cf td:first-child { color:var(--accent); font-weight:600; }
  .log { font-family:ui-monospace,Menlo,monospace; font-size:13px; margin-top:12px; white-space:pre-line; }
  .ok { color:var(--ok); } .bad { color:var(--bad); }
</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;

function dashboard(req) {
  const country = req.headers["cf-ipcountry"] || "unknown";
  const ray = req.headers["cf-ray"] || "not proxied";
  return page("SiamPay Edge Console", `
    <h1>SiamPay Edge Console</h1>
    <p class="sub">Fictional Thai fintech · origin on AWS EC2 (ap-southeast-1) · delivered through Cloudflare<br>
      This request: <code>cf-ray ${escapeHtml(ray)}</code> · country <code>${escapeHtml(country)}</code></p>
    <div class="grid">
      <div class="card"><h2>Request Inspector</h2>
        <p>Partners debug integrations by seeing exactly what reached our origin.</p>
        <a href="/headers">Inspect my request →</a></div>
      <div class="card"><h2>Full (strict) TLS</h2>
        <p>Browser → Cloudflare → origin is HTTPS end to end, validated against a Let's Encrypt certificate.</p></div>
      <div class="card"><h2>Rate limiting</h2>
        <p>Bursts against <code>/headers</code> are blocked at the edge before they reach the origin.</p>
        <button id="rl">Send 15 requests</button>
        <div class="log" id="log"></div></div>
      <div class="card"><h2>Staff portal</h2>
        <p>Internal tool behind Cloudflare Tunnel + Access. No inbound ports, identity-aware.</p>
        <a href="https://tunnel.strikemap.space/secure">Open secure portal →</a></div>
    </div>
    <script>
      document.getElementById("rl").onclick = async () => {
        const log = document.getElementById("log"); log.textContent = "";
        for (let i = 1; i <= 15; i++) {
          const r = await fetch("/headers?burst=" + i, { cache: "no-store" });
          const line = document.createElement("div");
          line.className = r.status === 200 ? "ok" : "bad";
          line.textContent = "Request " + i + " → " + r.status;
          log.appendChild(line);
        }
      };
    </script>`);
}

function headersPage(req) {
  const rows = Object.entries(req.headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `<tr class="${CF_HEADERS.has(k) ? "cf" : ""}"><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("");
  return page("Request headers", `
    <h1>HTTP request headers</h1>
    <p class="sub">Exactly what the origin received. Highlighted headers were added by Cloudflare.
      <a href="/">← back</a> · <a href="/headers?format=json">JSON</a></p>
    <div class="card"><table><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://origin");
  const send = (status, type, body) => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };

  if (url.pathname === "/healthz") return send(200, "text/plain; charset=utf-8", "OK");

  if (url.pathname === "/headers") {
    const wantsJson = url.searchParams.get("format") === "json" || (req.headers.accept || "").startsWith("application/json");
    if (wantsJson) return send(200, "application/json", JSON.stringify(req.headers, null, 2));
    return send(200, "text/html; charset=utf-8", headersPage(req));
  }

  if (url.pathname === "/") return send(200, "text/html; charset=utf-8", dashboard(req));

  send(404, "text/plain; charset=utf-8", "Not found");
});

server.listen(PORT, HOST, () => console.log(`origin listening on ${HOST}:${PORT}`));
