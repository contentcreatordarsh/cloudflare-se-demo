// SiamPay Edge Console — origin web server.
// Zero dependencies. Listens on 127.0.0.1 only; Nginx (TLS, public 443) and cloudflared (Tunnel) sit in front.
const http = require("http");
const fs = require("fs");
const path = require("path");
const tls = require("tls");
const { X509Certificate } = require("crypto");
const ui = require("./ui");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";
const CERT_PATH = process.env.CERT_PATH || "/etc/ssl/siampay/fullchain.pem";
const TUNNEL_READY_URL = process.env.TUNNEL_READY_URL || "http://127.0.0.1:20241/ready";
const EDGE_HOST = process.env.EDGE_HOST || "app.strikemap.space";
const FLAGS_DIR = process.env.FLAGS_DIR || path.join(__dirname, "flags");
const STARTED = Date.now();

/* ---------- live state, refreshed in the background (requests never wait on it) ---------- */
const state = { originCert: null, edgeCert: null, tunnel: null };

const dn = (s) => Object.fromEntries(String(s || "").split("\n").map((l) => l.split("=")).filter((p) => p.length >= 2).map(([k, ...v]) => [k, v.join("=")]));
function describeCert(x) {
  const issuer = dn(x.issuer), subject = dn(x.subject);
  const from = new Date(x.validFrom), to = new Date(x.validTo);
  const details = x.publicKey.asymmetricKeyDetails || {};
  return {
    subjectCN: subject.CN || x.subject,
    san: (x.subjectAltName || "").replaceAll("DNS:", ""),
    issuerOrg: issuer.O || x.issuer,
    issuerCN: issuer.CN || "",
    validFrom: from.toISOString(),
    validTo: to.toISOString(),
    daysLeft: Math.floor((to - Date.now()) / 86400000),
    totalDays: Math.round((to - from) / 86400000),
    keyType: x.publicKey.asymmetricKeyType,
    curve: details.namedCurve,
    bits: details.modulusLength,
    serial: x.serialNumber,
    fingerprint: x.fingerprint256,
  };
}

function refreshOriginCert() {
  try { state.originCert = describeCert(new X509Certificate(fs.readFileSync(CERT_PATH))); }
  catch { state.originCert = null; }
}

// Connect to our own hostname through Cloudflare to read the edge (browser-facing) certificate.
function refreshEdgeCert() {
  const sock = tls.connect({ host: EDGE_HOST, port: 443, servername: EDGE_HOST, timeout: 5000 }, () => {
    try { state.edgeCert = { ...describeCert(sock.getPeerX509Certificate()), protocol: sock.getProtocol() }; } catch {}
    sock.end();
  });
  sock.on("error", () => {});
  sock.on("timeout", () => sock.destroy());
}

// cloudflared exposes readiness (active edge connections) on its local metrics port.
async function refreshTunnel() {
  try {
    const r = await fetch(TUNNEL_READY_URL, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    state.tunnel = { ready: Number(j.readyConnections) || 0, connector: j.connectorId || null };
  } catch { state.tunnel = null; }
}

refreshOriginCert(); refreshEdgeCert(); refreshTunnel();
setInterval(refreshOriginCert, 10 * 60 * 1000).unref();
setInterval(refreshEdgeCert, 60 * 60 * 1000).unref();
setInterval(refreshTunnel, 15 * 1000).unref();

function health() {
  const up = Math.round((Date.now() - STARTED) / 1000);
  const upText = up < 3600 ? `${Math.floor(up / 60)}m` : `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`;
  const c = state.originCert, t = state.tunnel;
  const checks = [
    { name: "Origin app", ok: true, detail: `Node.js ${process.version} · up ${upText}` },
    { name: "Cloudflare Tunnel", ok: !!t && t.ready > 0, detail: t ? `${t.ready} edge connections` : "cloudflared not reachable" },
    { name: "Origin certificate", ok: !!c && c.daysLeft > 7, detail: c ? `${c.issuerOrg} · ${c.daysLeft} days left` : "not readable" },
  ];
  return { healthy: checks.every((x) => x.ok), checks };
}

/* ---------- request log (what actually reached the origin) ---------- */
const LOG = [];
const LOG_MAX = 100;
const QUIET = new Set(["/healthz", "/logs.json", "/status.json", "/favicon.svg", "/favicon.ico"]);

/* ---------- flags for the header country chip ---------- */
let FLAGS = new Set();
try { FLAGS = new Set(fs.readdirSync(FLAGS_DIR).filter((f) => /^[a-z]{2}\.svg$/.test(f)).map((f) => f.slice(0, 2))); } catch {}

function context(req, url) {
  const h = req.headers;
  const ray = h["cf-ray"] || null;
  const colo = ray && ray.includes("-") ? ray.split("-").pop().toUpperCase() : null;
  const country = /^[A-Za-z0-9]{2}$/.test(h["cf-ipcountry"] || "") ? h["cf-ipcountry"].toUpperCase() : null;
  const host = (h.host || "").toLowerCase();
  return {
    ray, colo, country, host,
    hasFlag: !!country && FLAGS.has(country.toLowerCase()),
    ip: h["cf-connecting-ip"] || null,
    via: !ray ? "direct" : host.startsWith("tunnel.") ? "tunnel" : "proxy",
    tlsProto: h["x-origin-tls-protocol"] || null,
    tlsCipher: h["x-origin-tls-cipher"] || null,
    cert: state.originCert,
    edgeCert: state.edgeCert,
    tunnel: state.tunnel,
    health: health(),
    path: url.pathname,
  };
}

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://origin");
  const send = (status, type, body, extra = {}) => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...SECURITY_HEADERS, ...extra });
    res.end(body);
  };
  const html = (status, body) => send(status, "text/html; charset=utf-8", body);
  const json = (status, obj) => send(status, "application/json", JSON.stringify(obj, null, 2));

  if (!QUIET.has(url.pathname) && !url.pathname.startsWith("/assets/")) {
    res.on("finish", () => {
      const ctx = { ray: req.headers["cf-ray"] || null };
      LOG.unshift({
        t: new Date().toISOString(),
        host: (req.headers.host || "").slice(0, 60),
        method: req.method,
        path: (url.pathname + url.search).slice(0, 80),
        status: res.statusCode,
        ray: ctx.ray,
        colo: ctx.ray && ctx.ray.includes("-") ? ctx.ray.split("-").pop() : null,
        country: req.headers["cf-ipcountry"] || null,
      });
      if (LOG.length > LOG_MAX) LOG.length = LOG_MAX;
    });
  }

  if (url.pathname === "/healthz") return send(200, "text/plain; charset=utf-8", "OK");
  if (url.pathname === "/favicon.svg") return send(200, "image/svg+xml", ui.FAVICON, { "cache-control": "public, max-age=86400" });

  const flag = url.pathname.match(/^\/assets\/flags\/([a-z]{2})\.svg$/);
  if (flag) {
    if (!FLAGS.has(flag[1])) return send(404, "text/plain; charset=utf-8", "Not found");
    return send(200, "image/svg+xml", fs.readFileSync(path.join(FLAGS_DIR, `${flag[1]}.svg`)), { "cache-control": "public, max-age=86400" });
  }

  const ctx = context(req, url);

  switch (url.pathname) {
    case "/":
      return html(200, ui.home(ctx));
    case "/headers": {
      const wantsJson = url.searchParams.get("format") === "json" || (req.headers.accept || "").startsWith("application/json");
      return wantsJson ? json(200, req.headers) : html(200, ui.requests(ctx, req.headers));
    }
    case "/certificates":
      return html(200, ui.certificates(ctx));
    case "/logs":
      return html(200, ui.logs(ctx, LOG));
    case "/logs.json":
      return json(200, LOG);
    case "/status.json":
      return json(200, { health: ctx.health, tunnel: state.tunnel, originCert: state.originCert, edgeCert: state.edgeCert });
    case "/settings":
      return html(200, ui.settings(ctx));
    default:
      return html(404, ui.notFound(ctx));
  }
});

server.listen(PORT, HOST, () => console.log(`origin listening on ${HOST}:${PORT}`));
