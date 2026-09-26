// NOVA public application — a deliberately simple Node.js/Express service on AWS EC2 (ap-southeast-1).
// Cloudflare is the control plane around it:
//   nova.strikemap.space    Cloudflare proxy -> Nginx (TLS, Full strict) -> this app
//   tunnel.strikemap.space  Cloudflare Access -> Worker -> Cloudflare Tunnel (cloudflared) -> this app
// Listens on loopback only (stricter than 0.0.0.0): nothing here is reachable without going through Cloudflare.
const path = require("path");
const express = require("express");
const { edgeInfo, esc } = require("./lib/edge");
const { page } = require("./lib/layout");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";

const app = express();
app.disable("x-powered-by");
app.set("json spaces", 2);
app.set("trust proxy", "loopback");

app.use((req, res, next) => {
  res.set({
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  const t0 = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`${req.method} ${req.hostname}${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms ray=${req.headers["cf-ray"] || "-"}`);
  });
  next();
});
app.use(express.json({ limit: "4kb" }));

// tunnel.strikemap.space is the private staff host: its front door is the Access-protected portal.
app.get("/", (req, res, next) => (req.hostname.startsWith("tunnel.") ? res.redirect(302, "/secure") : next()));

app.use(require("./routes/health"));
app.use(require("./routes/pages"));
app.use(require("./routes/headers"));
app.use(require("./routes/orders"));
app.use(require("./routes/staff"));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h", index: false }));

const wantsHtml = (req) => req.accepts(["application/json", "text/html"]) === "text/html";
const errorPage = (req, { code, title, text, href, cta }) =>
  page({
    title: `${code} · NOVA`,
    body: `
<div class="wrap page narrow err">
  <p class="kicker">${esc(title)}</p>
  <div class="err-code num">${code}</div>
  <p class="lede">${esc(text)}</p>
  ${edgeInfo(req).ray ? `<p class="dim">Request ID <span class="mono">${esc(edgeInfo(req).ray)}</span></p>` : ""}
  <a class="btn" href="${href}">${esc(cta)}</a>
</div>`,
  });

app.use((req, res) => {
  if (!wantsHtml(req)) return res.status(404).json({ error: "not_found" });
  res.status(404).send(errorPage(req, { code: 404, title: "Page not found", text: "The requested NOVA endpoint does not exist.", href: "/", cta: "Return home" }));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") return res.status(400).json({ error: "invalid_json_body" });
  console.error(`error ${req.method} ${req.originalUrl}: ${err.message}`);
  if (!wantsHtml(req)) return res.status(500).json({ error: "internal_error" }); // never leak stack traces
  res.status(500).send(errorPage(req, { code: 500, title: "Temporary service error", text: "The NOVA origin could not process the request.", href: "/status", cta: "Check status" }));
});

app.listen(PORT, HOST, () => console.log(`nova-origin listening on ${HOST}:${PORT}`));
