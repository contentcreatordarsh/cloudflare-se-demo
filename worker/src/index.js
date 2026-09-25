// Staff identity portal — served on tunnel.strikemap.space/secure*
//
//   GET /secure         -> "${EMAIL} authenticated at ${TIMESTAMP} from ${COUNTRY}" (HTML)
//   GET /secure/{CC}    -> country flag SVG streamed from a private R2 bucket
//
// Cloudflare Access sits in front of this route. We do not trust the plain
// cf-access-authenticated-user-email header: the Access JWT is verified
// (signature, issuer, audience, expiry) so identity cannot be spoofed.

const escapeHtml = (v) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const b64urlToBytes = (s) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

// Access signing keys, cached per isolate for 10 minutes.
let jwks = { keys: [], fetchedAt: 0 };
async function getKey(teamDomain, kid) {
  const fresh = Date.now() - jwks.fetchedAt < 10 * 60 * 1000;
  let jwk = fresh && jwks.keys.find((k) => k.kid === kid);
  if (!jwk) {
    const res = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error(`certs fetch failed: ${res.status}`);
    jwks = { keys: (await res.json()).keys, fetchedAt: Date.now() };
    jwk = jwks.keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error("unknown signing key");
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

async function verifyAccessJwt(token, env) {
  const parts = (token || "").split(".");
  if (parts.length !== 3) throw new Error("missing or malformed token");
  const [h, p, s] = parts;
  const header = b64urlToJson(h);
  if (header.alg !== "RS256") throw new Error("unexpected alg");

  const key = await getKey(env.TEAM_DOMAIN, header.kid);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`)
  );
  if (!valid) throw new Error("bad signature");

  const claims = b64urlToJson(p);
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== env.TEAM_DOMAIN) throw new Error("bad issuer");
  if (!aud.includes(env.POLICY_AUD)) throw new Error("bad audience");
  if (!claims.exp || claims.exp < now) throw new Error("token expired");
  if (!claims.email) throw new Error("no email claim");
  return claims;
}

const html = (body, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SiamPay Staff Portal</title>
<style>
  body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1115;color:#e8eaf0}
  main{max-width:720px;margin:0 auto;padding:56px 16px}
  h1{font-size:24px;margin:0 0 16px} .muted{color:#9aa3b2;font-size:14px}
  .card{background:#181b22;border:1px solid #2a2f3a;border-radius:12px;padding:24px;font-size:18px}
  a{color:#f6821f;font-weight:600}
</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } }
  );

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    let claims;
    try {
      claims = await verifyAccessJwt(request.headers.get("cf-access-jwt-assertion"), env);
    } catch (err) {
      return new Response(`Forbidden: ${err.message}`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    if (path === "/secure") {
      const country = request.cf?.country || "XX";
      const timestamp = new Date(claims.iat * 1000).toISOString();
      return html(`
        <h1>SiamPay Staff Portal</h1>
        <div class="card">
          ${escapeHtml(claims.email)} authenticated at ${escapeHtml(timestamp)} from
          <a href="/secure/${encodeURIComponent(country)}">${escapeHtml(country)}</a>
        </div>
        <p class="muted">Identity verified from the Cloudflare Access JWT at the edge. Timestamp is the Access login time (JWT iat).</p>`);
    }

    const match = path.match(/^\/secure\/([A-Za-z]{2})$/);
    if (match) {
      const cc = match[1].toLowerCase();
      const object = await env.FLAGS.get(`flags/${cc}.svg`);
      if (!object) {
        return new Response(`No flag for ${cc.toUpperCase()}`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      return new Response(object.body, {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control": "private, max-age=3600",
          etag: object.httpEtag,
        },
      });
    }

    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },
};
