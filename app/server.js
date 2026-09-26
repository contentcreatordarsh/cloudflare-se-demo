// NOVA public application — a deliberately simple Node.js/Express service on AWS EC2 (ap-southeast-1).
// Cloudflare is the control plane around it:
//   nova.strikemap.space    Cloudflare proxy -> Nginx (TLS, Full strict) -> this app
//   tunnel.strikemap.space  Cloudflare Access -> Worker -> Cloudflare Tunnel (cloudflared) -> this app
// Listens on loopback only; nothing on this host is reachable without going through Cloudflare.
const path = require("path");
const express = require("express");

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

// tunnel.strikemap.space is the private staff host: its front door is the Access-protected portal.
app.get("/", (req, res, next) => (req.hostname.startsWith("tunnel.") ? res.redirect(302, "/secure") : next()));

app.use(require("./routes/health"));
app.use(require("./routes/headers"));
app.use(require("./routes/orders"));
app.use(require("./routes/staff"));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h", index: "index.html" }));

app.use((req, res) => res.status(404).json({ error: "not_found" }));

app.listen(PORT, HOST, () => console.log(`nova-origin listening on ${HOST}:${PORT}`));
