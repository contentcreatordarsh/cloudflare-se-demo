// NOVA Staff Portal — Worker on tunnel.strikemap.space/secure*
//
//   Cloudflare Access  ->  this Worker  ->  Cloudflare Tunnel  ->  NOVA origin on AWS EC2 (ap-southeast-1)
//
//   GET /secure          premium staff portal (HTML): "${EMAIL} authenticated at ${TIMESTAMP} from ${COUNTRY}",
//                        plus live origin / tunnel status fetched from EC2 *through the Tunnel*
//   GET /secure/{CC}     the country flag, streamed from the private R2 bucket (image/svg+xml)
//   GET /secure/whoami   the verified Access identity as JSON (read by the Edge Console, CORS-restricted)
//
// Identity is never taken from a plain header: the Access JWT is verified here (signature, issuer, audience,
// expiry) and verified again by the origin.

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);

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
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!valid) throw new Error("bad signature");
  const claims = b64urlToJson(p);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== env.TEAM_DOMAIN) throw new Error("bad issuer");
  if (!aud.includes(env.POLICY_AUD)) throw new Error("bad audience");
  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) throw new Error("token expired");
  if (!claims.email) throw new Error("no email claim");
  return claims;
}

const sgt = (sec) => {
  const d = new Date(sec * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d).reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
};

let regionNames;
const countryName = (cc) => {
  try { regionNames ??= new Intl.DisplayNames(["en"], { type: "region" }); return regionNames.of(cc) || cc; } catch { return cc; }
};

/** Ask the origin, through Cloudflare Tunnel, for its live status. The origin re-verifies the Access JWT. */
async function originStatus(request, token) {
  const t0 = Date.now();
  try {
    const res = await fetch(new URL("/internal/staff-status", request.url), {
      headers: { "cf-access-jwt-assertion": token, cookie: request.headers.get("cookie") || "", accept: "application/json" },
    });
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, ms, error: `origin answered ${res.status}` };
    return { ok: true, ms, data: await res.json() };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: err.message };
  }
}

const CSS = `
:root{--bg:#08090a;--panel:#101214;--line:#1f2328;--line2:#2a2f36;--fg:#eceef0;--muted:#9aa1a9;--dim:#62686f;--brand:#f6821f;--brand2:#ff9d4d;--ok:#00d084;--bad:#ff4d5a;--violet:#a78bfa;--aws:#ff9900;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0}
body{font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--fg);background-color:var(--bg);min-height:100vh;
background-image:radial-gradient(800px 420px at 50% -10%,rgba(167,139,250,.10),transparent 65%),radial-gradient(rgba(255,255,255,.045) 1px,transparent 1px);background-size:auto,22px 22px;-webkit-font-smoothing:antialiased}
.mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
a{color:var(--brand2)}
.wrap{max-width:980px;margin:0 auto;padding:40px 20px 48px}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.mark{width:26px;height:26px;background:var(--brand);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)}
.brand b{font-size:20px;letter-spacing:.14em}.brand span{display:block;color:var(--muted);font-size:11px;letter-spacing:.22em;text-transform:uppercase}
.pill{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;border:1px solid rgba(0,208,132,.35);background:rgba(0,208,132,.08);color:#5ff0b0;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.pill i{width:7px;height:7px;border-radius:50%;background:var(--ok)}
.eyebrow{margin:34px 0 6px;color:var(--brand);font-size:12px;font-weight:600;letter-spacing:.22em;text-transform:uppercase}
h1{margin:0;font-size:clamp(28px,4.4vw,42px);letter-spacing:-.02em;line-height:1.12}
.lead{margin:14px 0 0;padding:16px 18px;border:1px solid var(--line2);border-left:3px solid var(--brand);border-radius:8px;background:rgba(16,18,20,.9);font-size:17px}
.grid{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;margin-top:18px}
.card{border:1px solid var(--line);border-radius:10px;background:rgba(16,18,20,.9);padding:6px 18px 10px}
.card h2{margin:12px 0 4px;color:var(--dim);font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase}
.row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}.row .k{color:var(--muted);font-size:13.5px}.row .v{font-weight:600;text-align:right}
.v small{display:block;color:var(--dim);font-weight:400;font-size:12px}
.flagrow{display:flex;align-items:center;gap:10px;justify-content:flex-end}
.flagrow img{width:30px;height:22px;border-radius:3px;box-shadow:0 0 0 1px rgba(255,255,255,.14);object-fit:cover}
.status .row .v{font-size:12px;letter-spacing:.14em;text-transform:uppercase}
.ok{color:var(--ok)}.bad{color:var(--bad)}
.r2{display:flex;gap:16px;align-items:center;margin-top:14px;padding:14px 18px}
.r2 img{width:96px;height:72px;border-radius:6px;box-shadow:0 0 0 1px rgba(255,255,255,.14);object-fit:cover;flex:none}
.r2 .t{color:var(--dim);font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase}
.chain{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:18px;color:var(--muted);font-size:13px}
.chain b{color:var(--fg);font-weight:600}.chain i{color:var(--dim);font-style:normal}
.foot{margin-top:24px;color:var(--dim);font-size:12px}
@media (max-width:760px){.grid{grid-template-columns:1fr}}
`;

function portal({ claims, country, status, env }) {
  const cc = /^[A-Z]{2}$/.test(country) ? country : "XX";
  const name = cc === "XX" ? "Unknown" : countryName(cc);
  const at = sgt(claims.iat);
  const o = status.ok ? status.data : null;
  const tunnel = o?.connection?.tunnel;
  const originOk = !!o?.origin?.healthy;
  const tunnelOk = !!tunnel?.connected;
  const flagSrc = `/secure/${encodeURIComponent(cc)}`;
  const st = (ok, yes, no) => `<span class="${ok ? "ok" : "bad"}">● ${ok ? yes : no}</span>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NOVA Staff Portal</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<style>${CSS}</style></head><body><main class="wrap">
  <div class="top">
    <div class="brand"><span class="mark"></span><div><b>NOVA</b><span>Staff Portal</span></div></div>
    <span class="pill"><i></i>Identity verified</span>
  </div>

  <p class="eyebrow">Secure operations</p>
  <h1>Authenticated</h1>
  <p class="lead">${escapeHtml(claims.email)} authenticated at <span class="mono">${escapeHtml(`${at.date} ${at.time} SGT`)}</span> from <a href="${flagSrc}">${escapeHtml(cc)}</a></p>

  <div class="grid">
    <section class="card">
      <h2>Session</h2>
      <div class="row"><span class="k">Identity</span><span class="v">${escapeHtml(claims.email)}<small>Cloudflare Access · JWT verified by Worker${o ? " and origin" : ""}</small></span></div>
      <div class="row"><span class="k">Authenticated at</span><span class="v mono">${escapeHtml(at.time)} SGT<small>${escapeHtml(at.date)}</small></span></div>
      <div class="row"><span class="k">Location</span><span class="v flagrow">${escapeHtml(name)} <img src="${flagSrc}" alt="${escapeHtml(name)} flag"></span></div>
      <div class="row"><span class="k">Access policy</span><span class="v">NOVA Staff<small>owner or any @cloudflare.com identity</small></span></div>
      <div class="row"><span class="k">Connection</span><span class="v">Cloudflare Tunnel<small>${tunnel ? `${tunnel.connections} edge connections · Worker → EC2 round trip ${status.ms} ms` : escapeHtml(status.error || "status unavailable")}</small></span></div>
      <div class="row"><span class="k">Origin</span><span class="v">AWS EC2<small>ap-southeast-1${o ? ` · ${escapeHtml(o.origin.host)} · Node ${escapeHtml(o.origin.node)}` : ""}</small></span></div>
    </section>
    <section class="card status">
      <h2>System status</h2>
      <div class="row"><span class="k">Origin</span><span class="v">${st(originOk, "Healthy", "Unreachable")}</span></div>
      <div class="row"><span class="k">Tunnel</span><span class="v">${st(tunnelOk, "Connected", "Down")}</span></div>
      <div class="row"><span class="k">Access</span><span class="v">${st(true, "Verified", "")}</span></div>
      <div class="row"><span class="k">R2 bucket</span><span class="v"><span class="ok">● Private</span></span></div>
    </section>
  </div>

  <section class="card r2">
    <img src="${flagSrc}" alt="">
    <div>
      <div class="t">Private R2 object</div>
      <div class="mono" style="font-size:16px;margin-top:2px">${escapeHtml(cc)}.svg</div>
      <div style="color:var(--muted);font-size:13px">Retrieved by Cloudflare Worker · bucket <span class="mono">${escapeHtml(env.FLAGS_BUCKET_NAME || "nova-country-flags")}</span> (private, no public URL)</div>
    </div>
  </section>

  <div class="chain"><b>Cloudflare Access</b><i>→</i><b>Worker</b><i>→</i><b>Cloudflare Tunnel</b><i>→</i><b>AWS EC2</b><i>·</i><span>no inbound ports</span></div>
  <p class="foot">NOVA is a fictional company used for a Cloudflare Solutions Engineering demo.</p>
</main></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const token = request.headers.get("cf-access-jwt-assertion");

    let claims;
    try {
      claims = await verifyAccessJwt(token, env);
    } catch (err) {
      return new Response(`Forbidden: ${err.message}`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    if (path === "/secure/whoami") {
      return new Response(
        JSON.stringify({
          email: claims.email,
          authenticatedAt: new Date(claims.iat * 1000).toISOString(),
          expiresAt: new Date(claims.exp * 1000).toISOString(),
          country: request.cf?.country || null,
          verifiedBy: "Cloudflare Access (JWT verified by Worker)",
        }),
        { headers: { "content-type": "application/json", "cache-control": "private, no-store", "access-control-allow-origin": env.CONSOLE_ORIGIN, "access-control-allow-credentials": "true", vary: "Origin" } }
      );
    }

    if (path === "/secure") {
      const status = await originStatus(request, token);
      return new Response(portal({ claims, country: request.cf?.country || "XX", status, env }), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
      });
    }

    const match = path.match(/^\/secure\/([A-Za-z]{2})$/);
    if (match) {
      const cc = match[1].toUpperCase();
      const object = await env.FLAGS.get(`${cc}.svg`);
      if (!object) {
        return new Response(`No flag for ${cc}`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      return new Response(object.body, {
        headers: { "content-type": "image/svg+xml", "cache-control": "private, max-age=3600", etag: object.httpEtag, "x-nova-source": "private-r2" },
      });
    }

    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },
};
