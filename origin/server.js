// NOVA origin API (Node.js, zero dependencies). NOVA is a fictional Singapore digital-asset platform.
// Listens on 127.0.0.1 only. Nginx terminates TLS for app.strikemap.space and serves the React
// console from /var/www/siampay/dist; cloudflared delivers tunnel.strikemap.space traffic here directly.
//
//   GET /headers       all request headers as JSON (assignment endpoint, rate-limit target)
//   GET /api/trace     what the origin saw for this request (Ray ID, edge, TLS, timings, headers)
//   GET /api/quote     demo trading API — same trace plus a mock quote (not market data)
//   GET /api/status    live health: cloudflared readiness, origin + edge certificates
//   GET /api/logs      last 100 requests that actually reached the origin
//   GET /api/me        the signed-in viewer, from the Cloudflare Access JWT (signature verified here)
const http = require("http");
const fs = require("fs");
const tls = require("tls");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";
const CERT_PATH = process.env.CERT_PATH || "/etc/ssl/siampay/fullchain.pem";
const TUNNEL_READY_URL = process.env.TUNNEL_READY_URL || "http://127.0.0.1:20241/ready";
const EDGE_HOST = process.env.EDGE_HOST || "app.strikemap.space";
const ORIGIN_PUBLIC_IP = process.env.ORIGIN_PUBLIC_IP || "";
const STARTED = Date.now();

/* ---------- live state, refreshed in the background ---------- */
const state = { originCert: null, edgeCert: null, tunnel: null };

const dn = (s) => Object.fromEntries(String(s || "").split("\n").map((l) => l.split("=")).filter((p) => p.length >= 2).map(([k, ...v]) => [k, v.join("=")]));
function describeCert(x) {
  const issuer = dn(x.issuer), subject = dn(x.subject);
  const from = new Date(x.validFrom), to = new Date(x.validTo);
  const d = x.publicKey.asymmetricKeyDetails || {};
  const key = x.publicKey.asymmetricKeyType === "ec"
    ? ({ prime256v1: "ECDSA P-256", secp384r1: "ECDSA P-384" }[d.namedCurve] || `ECDSA ${d.namedCurve}`)
    : `RSA ${d.modulusLength || ""}`.trim();
  return {
    subject: subject.CN || x.subject,
    san: (x.subjectAltName || "").replaceAll("DNS:", "").split(", ").filter(Boolean),
    issuerOrg: issuer.O || x.issuer,
    issuerCN: issuer.CN || "",
    validFrom: from.toISOString(),
    validTo: to.toISOString(),
    daysLeft: Math.floor((to - Date.now()) / 86400000),
    totalDays: Math.round((to - from) / 86400000),
    key,
    serial: x.serialNumber,
    fingerprint: x.fingerprint256,
  };
}

function refreshOriginCert() {
  try { state.originCert = describeCert(new crypto.X509Certificate(fs.readFileSync(CERT_PATH))); }
  catch { state.originCert = null; }
}
function refreshEdgeCert() { // the browser-facing certificate, read through Cloudflare like a visitor would
  const sock = tls.connect({ host: EDGE_HOST, port: 443, servername: EDGE_HOST, timeout: 5000 }, () => {
    try { state.edgeCert = { ...describeCert(sock.getPeerX509Certificate()), protocol: sock.getProtocol() }; } catch {}
    sock.end();
  });
  sock.on("error", () => {});
  sock.on("timeout", () => sock.destroy());
}
async function refreshTunnel() { // cloudflared readiness + per-connection Cloudflare edge locations
  try {
    const j = await (await fetch(TUNNEL_READY_URL, { signal: AbortSignal.timeout(1500) })).json();
    const t = { ready: Number(j.readyConnections) || 0, connector: j.connectorId || null, locations: [], requests: null, errors: null };
    try {
      const m = await (await fetch(TUNNEL_READY_URL.replace(/\/ready$/, "/metrics"), { signal: AbortSignal.timeout(1500) })).text();
      t.locations = [...m.matchAll(/cloudflared_tunnel_server_locations\{connection_id="(\d+)",edge_location="([a-z0-9]+)"\} 1/g)].map((x) => ({ id: Number(x[1]), colo: x[2] }));
      t.requests = Number((m.match(/^cloudflared_tunnel_total_requests (\d+)/m) || [])[1] ?? NaN) || 0;
      t.errors = Number((m.match(/^cloudflared_tunnel_request_errors (\d+)/m) || [])[1] ?? NaN) || 0;
    } catch {}
    state.tunnel = t;
  } catch { state.tunnel = null; }
}
refreshOriginCert(); refreshEdgeCert(); refreshTunnel();
setInterval(refreshOriginCert, 10 * 60 * 1000).unref();
setInterval(refreshEdgeCert, 60 * 60 * 1000).unref();
setInterval(refreshTunnel, 15 * 1000).unref();

function health() {
  const c = state.originCert, t = state.tunnel;
  const checks = [
    { id: "origin", name: "AWS Origin", ok: true, detail: `Node.js ${process.version} · up ${Math.round((Date.now() - STARTED) / 60000)} min` },
    { id: "tunnel", name: "Cloudflare Tunnel", ok: !!t && t.ready > 0, detail: t ? `${t.ready} edge connections` : "cloudflared not reachable" },
    { id: "cert", name: "Origin certificate", ok: !!c && c.daysLeft > 7, detail: c ? `${c.issuerOrg} · ${c.daysLeft} days left` : "not readable" },
  ];
  return { healthy: checks.every((x) => x.ok), checks };
}

/* ---------- request log: what actually reached the origin ---------- */
const LOG = [];
const QUIET = new Set(["/healthz", "/api/logs", "/api/status", "/api/me"]);

const mask = (ip) => {
  if (!ip) return null;
  if (ip.includes(".")) return ip.split(".").slice(0, 2).join(".") + ".xxx.xxx";
  return ip.split(":").slice(0, 3).join(":") + ":xxxx::";
};
const coloOf = (ray) => (ray && ray.includes("-") ? ray.split("-").pop().toUpperCase() : null);

function trace(req, url, startedNs) {
  const h = req.headers;
  const ray = h["cf-ray"] || null;
  const host = (h.host || "").toLowerCase();
  return {
    message: "NOVA request reached origin",
    receivedAt: new Date().toISOString(),
    ray,
    colo: coloOf(ray),
    country: h["cf-ipcountry"] || null,
    method: req.method,
    path: url.pathname + url.search,
    host,
    via: !ray ? "direct" : host.startsWith("tunnel.") ? "tunnel" : "proxy",
    clientIp: mask(h["cf-connecting-ip"]),
    edgeIp: mask(h["x-edge-ip"]),
    originIp: mask(ORIGIN_PUBLIC_IP),
    originTls: { protocol: h["x-origin-tls-protocol"] || null, cipher: h["x-origin-tls-cipher"] || null },
    originCert: state.originCert && { issuerOrg: state.originCert.issuerOrg, issuerCN: state.originCert.issuerCN, daysLeft: state.originCert.daysLeft, validTo: state.originCert.validTo },
    appMs: Number(process.hrtime.bigint() - startedNs) / 1e6,
    headers: h,
  };
}

const SECURITY_HEADERS = { "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };

/* ---------- Cloudflare Access identity for the console (JWT verified, never trusted from a plain header) ---------- */
const ACCESS_TEAM = process.env.ACCESS_TEAM_DOMAIN || "https://hegdedarsh.cloudflareaccess.com";
const CONSOLE_AUD = process.env.CONSOLE_ACCESS_AUD || "dbbd66e1294b17d0cc5ced2cf0968f6ac1e5bbc4457657f1b32d7910104caef4";
let jwks = { keys: [], at: 0 };
async function signingKey(kid) {
  let jwk = Date.now() - jwks.at < 600000 && jwks.keys.find((k) => k.kid === kid);
  if (!jwk) {
    const r = await fetch(`${ACCESS_TEAM}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(3000) });
    jwks = { keys: (await r.json()).keys || [], at: Date.now() };
    jwk = jwks.keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error("unknown signing key");
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}
async function accessIdentity(token) {
  const [h, p, sig] = String(token || "").split(".");
  if (!h || !p || !sig) throw new Error("no Access token");
  const header = JSON.parse(Buffer.from(h, "base64url"));
  if (header.alg !== "RS256") throw new Error("unexpected alg");
  if (!crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), await signingKey(header.kid), Buffer.from(sig, "base64url"))) throw new Error("bad signature");
  const c = JSON.parse(Buffer.from(p, "base64url"));
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (c.iss !== ACCESS_TEAM || !aud.includes(CONSOLE_AUD)) throw new Error("wrong issuer/audience");
  if (!c.exp || c.exp < Date.now() / 1000) throw new Error("token expired");
  return { email: c.email || null, country: c.country || null, authenticatedAt: new Date(c.iat * 1000).toISOString(), expiresAt: new Date(c.exp * 1000).toISOString(), verified: "RS256 signature, issuer, audience, expiry" };
}

const server = http.createServer((req, res) => {
  const startedNs = process.hrtime.bigint();
  const url = new URL(req.url, "http://origin");
  const host = (req.headers.host || "").toLowerCase();
  const send = (status, body, extra = {}) => {
    const appMs = Number(process.hrtime.bigint() - startedNs) / 1e6;
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "server-timing": `app;dur=${appMs.toFixed(2)}`,
      ...SECURITY_HEADERS,
      ...extra,
    });
    res.end(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  };

  if (!QUIET.has(url.pathname)) {
    res.on("finish", () => {
      const ray = req.headers["cf-ray"] || null;
      LOG.unshift({
        t: new Date().toISOString(), host: host.slice(0, 60), method: req.method,
        path: (url.pathname + url.search).slice(0, 80), status: res.statusCode,
        ray, colo: coloOf(ray), country: req.headers["cf-ipcountry"] || null,
        ms: Number((Number(process.hrtime.bigint() - startedNs) / 1e6).toFixed(2)),
      });
      if (LOG.length > 100) LOG.length = 100;
    });
  }

  // tunnel.strikemap.space is the internal staff host: its front door is the Access-protected portal.
  if (host.startsWith("tunnel.") && url.pathname === "/") {
    res.writeHead(302, { location: "/secure", "cache-control": "no-store" });
    return res.end();
  }

  switch (url.pathname) {
    case "/healthz":
      return send(200, "OK", { "content-type": "text/plain; charset=utf-8" });
    case "/headers":
      return send(200, req.headers);
    case "/api/trace":
      return send(200, trace(req, url, startedNs));
    case "/api/quote": {
      const pair = /^[A-Z]{2,6}-[A-Z]{2,6}$/.test(url.searchParams.get("pair") || "") ? url.searchParams.get("pair") : "BTC-SGD";
      return send(200, {
        ...trace(req, url, startedNs),
        quote: { id: `q_${crypto.randomBytes(6).toString("hex")}`, pair, status: "demo quote — not market data" },
      });
    }
    case "/api/status":
      return send(200, { health: health(), tunnel: state.tunnel, originCert: state.originCert, edgeCert: state.edgeCert, serverTime: new Date().toISOString() });
    case "/api/logs":
      return send(200, LOG);
    case "/api/me":
      accessIdentity(req.headers["cf-access-jwt-assertion"])
        .then((me) => send(200, me))
        .catch((e) => send(401, { error: "no_verified_identity", detail: e.message }));
      return;
    default:
      return send(404, { error: "not_found" });
  }
});

server.listen(PORT, HOST, () => console.log(`origin API listening on ${HOST}:${PORT}`));
