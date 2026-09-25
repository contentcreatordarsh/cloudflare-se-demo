// SiamPay Edge Console — server-rendered UI (no runtime dependencies).
// Every value shown comes from the live request, the origin's certificate, cloudflared's
// readiness endpoint or the origin's own request log — nothing is simulated.
const MAP = require("./world-map");

const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const EDGE_HOST = "app.strikemap.space";
const PORTAL_URL = "https://tunnel.strikemap.space/secure";
const REPO_URL = "https://github.com/contentcreatordarsh/cloudflare-se-demo";

/* ---------- icons (Lucide-style, ISC) ---------- */
const ICONS = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  requests: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  cert: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  logs: '<path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
};
const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 7.5h-6a3 3 0 0 0 0 6h3a3 3 0 0 1 0 6h-6"/></svg>';

/* ---------- small helpers ---------- */
const flagImg = (ctx, cls = "flag") =>
  ctx.hasFlag ? `<img class="${cls}" src="/assets/flags/${esc(ctx.country.toLowerCase())}.svg" alt="" width="20" height="15">` : icon("globe", "flag-fallback");
const rayText = (ctx) => (ctx.ray ? `cf-ray ${ctx.ray}` : "not proxied (direct)");
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "—";
const keyLabel = (cert) => {
  if (!cert) return "—";
  if (cert.keyType === "ec") return { prime256v1: "ECDSA P-256", secp384r1: "ECDSA P-384" }[cert.curve] || `ECDSA ${cert.curve}`;
  if (cert.keyType === "rsa") return `RSA ${cert.bits || ""}`.trim();
  return cert.keyType || "—";
};
const originTlsText = (ctx) =>
  ctx.via === "tunnel" ? "Cloudflare Tunnel (encrypted)" : ctx.tlsProto ? ctx.tlsProto.replace("TLSv", "TLS ") : "—";

/* ---------- styles ---------- */
const CSS = `
:root{--bg:#05070d;--line:rgba(148,163,184,.12);--line2:rgba(148,163,184,.2);--text:#e7ecf6;--muted:#94a0b8;--dim:#64708a;
--blue:#3b82f6;--blue2:#60a5fa;--cyan:#22d3ee;--teal:#2dd4bf;--green:#34d399;--ok:#22c55e;--purple:#8b5cf6;--violet:#a78bfa;
--orange:#f6821f;--amber:#fbbf24;--red:#f87171;--aws:#ff9900;
--sans:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0}
body{font:14px/1.5 var(--sans);color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;min-height:100vh;
background-image:radial-gradient(900px 520px at 72% -8%,rgba(59,130,246,.13),transparent 60%),radial-gradient(720px 480px at 100% 40%,rgba(139,92,246,.09),transparent 60%),radial-gradient(640px 420px at 22% 108%,rgba(45,212,191,.06),transparent 60%);background-attachment:fixed}
a{color:inherit;text-decoration:none}
:focus-visible{outline:2px solid var(--blue2);outline-offset:2px;border-radius:8px}
.i{width:1em;height:1em;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
code,.mono{font-family:var(--mono);font-size:12px}
.muted{color:var(--muted)}.ok-text{color:var(--green)}.warn-text{color:var(--amber)}

/* sidebar */
.sidebar{position:fixed;inset:0 auto 0 0;width:240px;display:flex;flex-direction:column;gap:26px;padding:22px 14px;background:linear-gradient(180deg,rgba(9,13,24,.94),rgba(6,9,17,.97));border-right:1px solid var(--line);z-index:20}
.brand{display:flex;align-items:center;gap:12px;padding:2px 10px}
.logo{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none;background:linear-gradient(135deg,#3b82f6,#8b5cf6);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 8px 22px -8px rgba(99,102,241,.7)}
.logo svg{width:22px;height:22px;stroke:#fff;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.brand b{display:block;font-size:16px;letter-spacing:-.01em}.brand small{display:block;color:var(--muted);font-size:12px;margin-top:-2px}
.nav{display:flex;flex-direction:column;gap:3px}
.nav-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);padding:0 12px 8px}
.nav a{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px;color:var(--muted);font-weight:500;border:1px solid transparent;transition:color .15s,background .15s}
.nav a .i{font-size:18px}
.nav a:hover{color:var(--text);background:rgba(148,163,184,.06)}
.nav a[aria-current=page]{color:#fff;background:linear-gradient(90deg,rgba(59,130,246,.2),rgba(59,130,246,.04));border-color:rgba(59,130,246,.3);box-shadow:inset 2px 0 0 var(--blue2)}
.sys{margin-top:auto;display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:12px;border:1px solid rgba(34,197,94,.22);background:rgba(34,197,94,.06)}
.sys b{display:block;font-size:13px}.sys small{display:block;color:var(--muted);font-size:12px}
.sys.warn{border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.07)}
.pulse{width:9px;height:9px;border-radius:50%;background:var(--ok);margin-top:5px;flex:none;animation:pulse 2.2s infinite}
.sys.warn .pulse{background:var(--amber);animation:none}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}

/* top bar */
.main{margin-left:240px;min-width:0}
.topbar{position:sticky;top:0;z-index:15;display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:60px;padding:0 28px;background:rgba(5,7,13,.75);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.crumbs{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;min-width:0}
.crumbs b{color:var(--text);font-weight:600}
.zone{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border:1px solid var(--line2);border-radius:999px;font:500 12px var(--mono);color:var(--text)}
.zone .i{color:var(--orange)}
.controls{display:flex;align-items:center;gap:10px}
.menu{position:relative}
.menu>summary{list-style:none;cursor:pointer}.menu>summary::-webkit-details-marker{display:none}
.chip{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 12px;border:1px solid var(--line2);border-radius:10px;background:rgba(15,21,36,.7);font-weight:600;font-size:13px;transition:border-color .15s}
.chip:hover,.menu[open]>.chip{border-color:rgba(148,163,184,.4)}
.chip .chev{font-size:14px;color:var(--muted);transition:transform .15s}.menu[open] .chev{transform:rotate(180deg)}
.flag{width:20px;height:15px;border-radius:3px;object-fit:cover;box-shadow:0 0 0 1px rgba(255,255,255,.14)}
.flag-fallback{font-size:16px;color:var(--muted)}
.avatar{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;color:#fff;background:linear-gradient(135deg,#f6821f,#8b5cf6)}
.pop{position:absolute;right:0;top:calc(100% + 8px);width:320px;padding:8px;border:1px solid var(--line2);border-radius:12px;background:rgba(11,16,28,.98);box-shadow:0 24px 60px -16px rgba(0,0,0,.8);z-index:30}
.pop h4{margin:4px 10px 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-weight:600}
.pop .row{display:flex;justify-content:space-between;gap:12px;padding:8px 10px;font-size:13px}
.pop .row span{color:var(--muted)}.pop .row b{font-family:var(--mono);font-size:12px;font-weight:500;text-align:right;word-break:break-all}
.pop .note{padding:8px 10px 4px;color:var(--dim);font-size:12px;border-top:1px solid var(--line);margin-top:4px}
.pop a.item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;font-size:13px}
.pop a.item:hover{background:rgba(148,163,184,.08)}.pop a.item .i{color:var(--muted);font-size:16px}

.content{padding:20px 28px 28px;max-width:1600px}

/* hero */
.hero{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.25fr);gap:28px;align-items:center;margin-bottom:12px}
.eyebrow{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 14px}
.eyebrow .sep{width:4px;height:4px;border-radius:50%;background:var(--dim)}
h1{font-size:clamp(30px,calc(3.95vw - 13px),52px);line-height:1.04;letter-spacing:-.035em;margin:0 0 16px;font-weight:700}
.grad{background:linear-gradient(90deg,#60a5fa,#818cf8 48%,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
.lede{color:var(--muted);font-size:16px;line-height:1.6;margin:0 0 22px;max-width:560px}
.lede strong{color:var(--text);font-weight:500}
.pills{display:flex;flex-wrap:wrap;gap:10px}
.pill{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 6px 0 12px;border:1px solid var(--line2);border-radius:999px;background:rgba(15,21,36,.6);font-size:13px;max-width:100%}
.pill.plain{padding-right:14px}
.pill .k{color:var(--muted);white-space:nowrap}.pill code{color:#fdba74;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iconbtn{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:999px;border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:14px}
.iconbtn:hover{color:#fff;background:rgba(148,163,184,.14)}
.iconbtn.done{color:var(--green)}

.map{position:relative}
.map-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:4px;font-size:12px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase;font-weight:600}
.live{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;padding:4px 10px;border-radius:999px;border:1px solid rgba(34,197,94,.25);background:rgba(34,197,94,.07);color:#86efac;text-transform:none;letter-spacing:0;font:500 12px var(--mono)}
.live i{width:7px;height:7px;border-radius:50%;background:var(--ok);animation:pulse 2.2s infinite}
.map svg{display:block;width:100%;height:auto;-webkit-mask-image:radial-gradient(ellipse 82% 92% at 50% 50%,#000 60%,transparent 100%);mask-image:radial-gradient(ellipse 82% 92% at 50% 50%,#000 60%,transparent 100%)}
.map-legend{display:flex;flex-wrap:wrap;gap:18px;justify-content:flex-end;color:var(--dim);font-size:12px;margin-top:2px}
.lg{display:inline-flex;align-items:center;gap:7px}
.lg .d{width:7px;height:7px;border-radius:50%;background:var(--orange);box-shadow:0 0 8px var(--orange)}
.lg .l{width:20px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(34,211,238,.1),#67e8f9)}
.lg .s{width:9px;height:9px;border-radius:2px;background:var(--aws)}
.dots path{fill:none;stroke-linecap:round;stroke-width:2.3}
.route{fill:none;stroke:rgba(96,165,250,.28);stroke-width:1}
.trail{fill:none;stroke:#7dd3fc;stroke-width:1.8;stroke-linecap:round;stroke-dasharray:9 191;stroke-dashoffset:9;animation:trail var(--dur,3.6s) linear infinite;animation-delay:var(--delay,0s)}
@keyframes trail{from{stroke-dashoffset:9}to{stroke-dashoffset:-100}}
.pop-node{fill:var(--orange)}.pop-ring{fill:none;stroke:rgba(246,130,31,.35);stroke-width:1}
.sin-pulse{fill:none;stroke:#fdba74;stroke-width:1.2;transform-box:fill-box;transform-origin:center;animation:ring 2.6s ease-out infinite}
@keyframes ring{from{transform:scale(.4);opacity:.9}to{transform:scale(2.4);opacity:0}}
.aws-link{fill:none;stroke:var(--aws);stroke-width:1.4;stroke-dasharray:3 4;animation:flow 1.2s linear infinite}
@keyframes flow{to{stroke-dashoffset:-14}}
.svg-label{font-family:var(--sans)}

/* request path */
.flow{display:flex;align-items:center;gap:6px;margin:0 0 14px;padding:7px 8px;border:1px solid var(--line);border-radius:14px;background:rgba(10,14,25,.55)}
.flow-title{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);font-weight:600;padding:0 8px 0 6px;white-space:nowrap}
.step{flex:1;display:flex;align-items:center;gap:10px;padding:4px 8px;border-radius:10px;min-width:0}
.step .ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:16px;flex:none;background:rgba(148,163,184,.08);color:var(--muted)}
.step b{display:block;font-size:13px;font-weight:600;white-space:nowrap}.step small{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.step.cf .ic{background:rgba(246,130,31,.14);color:var(--orange)}.step.sec .ic{background:rgba(45,212,191,.12);color:var(--teal)}
.step.aws .ic{background:rgba(255,153,0,.12);color:var(--aws)}.step.app .ic{background:rgba(139,92,246,.14);color:var(--violet)}
.step.users .ic{background:rgba(59,130,246,.14);color:var(--blue2)}
.flow .arrow{color:var(--dim);font-size:15px;flex:none}

/* cards */
.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.card{--c:59,130,246;position:relative;display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:16px;overflow:hidden;
border:1px solid rgba(var(--c),.26);background:linear-gradient(180deg,rgba(var(--c),.1),rgba(13,18,31,.7) 40%),rgba(9,13,24,.62);
box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 28px 56px -34px rgba(var(--c),.55);transition:border-color .2s}
.card:hover{border-color:rgba(var(--c),.46)}
.card::before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(var(--c),.9),transparent)}
.c-blue{--c:59,130,246}.c-teal{--c:45,212,191}.c-orange{--c:246,130,31}.c-purple{--c:139,92,246}
.card-head{display:flex;align-items:center;gap:12px}
.tile{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:20px;flex:none;color:rgb(var(--c));background:rgba(var(--c),.14);border:1px solid rgba(var(--c),.32);box-shadow:0 0 26px -6px rgba(var(--c),.65)}
.c-orange .tile{color:#fdba74;background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(246,130,31,.22));border-color:rgba(246,130,31,.38)}
.card h2{font-size:17px;margin:0;letter-spacing:-.01em;font-weight:650}
.tag{margin-left:auto;font:500 11px var(--mono);white-space:nowrap;color:rgb(var(--c));padding:3px 8px;border-radius:999px;background:rgba(var(--c),.1);border:1px solid rgba(var(--c),.25)}
.desc{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
.desc code{color:#fdba74;background:rgba(246,130,31,.1);padding:1px 6px;border-radius:5px}
.panel{border:1px solid var(--line);border-radius:12px;background:rgba(4,7,14,.55);padding:2px 14px}
.kv{margin:0}.kv>div{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px dashed rgba(148,163,184,.1);font-size:13px}
.kv>div:last-child{border-bottom:0}.kv dt{color:var(--muted);white-space:nowrap}
.kv dd{margin:0;text-align:right;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv dd.mono{font-size:11.5px;color:#fdba74}
.badge{display:inline-flex;align-items:center;padding:1px 7px;margin-left:6px;border-radius:6px;font:500 11px var(--mono);color:#fdba74;background:rgba(246,130,31,.12)}
.feat{display:flex;gap:11px;align-items:center;padding:6px 0;line-height:1.3;border-bottom:1px dashed rgba(148,163,184,.1)}
.feat:last-child{border-bottom:0}
.feat .fi{width:27px;height:27px;border-radius:8px;display:grid;place-items:center;font-size:14px;flex:none;color:rgb(var(--c));background:rgba(var(--c),.1)}
.feat b{display:block;font-size:11.5px;font-weight:500;color:var(--muted)}.feat span{display:block;font-size:13px;font-weight:600}
.feat .meta{margin-left:auto;flex:none;font:500 11px var(--mono);padding:2px 8px;border-radius:999px;border:1px solid var(--line2);color:var(--muted);white-space:nowrap}
.feat .meta.ok{color:#86efac;border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.08)}.feat .meta.bad{color:var(--amber);border-color:rgba(251,191,36,.35)}
.card-foot{margin-top:auto;display:flex;gap:10px;align-items:center}
.btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:0 16px;border-radius:10px;font:600 13.5px var(--sans);border:1px solid transparent;cursor:pointer;color:#fff;transition:filter .15s,transform .15s}
.btn:hover{filter:brightness(1.12)}.btn:active{transform:translateY(1px)}.btn .i{font-size:16px}
.btn-blue{background:linear-gradient(180deg,#3b82f6,#2563eb);box-shadow:0 10px 26px -12px rgba(59,130,246,.95)}
.btn-teal{background:rgba(45,212,191,.1);border-color:rgba(45,212,191,.5);color:#5eead4}
.btn-orange{background:linear-gradient(180deg,#f6821f,#e8680a);box-shadow:0 10px 26px -12px rgba(246,130,31,.95)}
.btn-purple{background:linear-gradient(90deg,#6366f1,#8b5cf6);box-shadow:0 10px 26px -12px rgba(139,92,246,.95)}
.btn[disabled]{opacity:.75;cursor:progress}
.round{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;flex:none;border:1px solid var(--line2);color:var(--muted);font-size:16px;transition:color .15s,border-color .15s}
.round:hover{color:#fff;border-color:rgba(var(--c),.7)}

/* rate limit card */
.rl-state{display:flex;align-items:center;gap:10px;padding:9px 0 7px;line-height:1.3}
.rl-state .pulse{margin-top:0}.rl-state b{display:block;font-size:13px}.rl-state small{display:block;color:var(--muted);font-size:12.5px}
.rule{font:500 11px var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fdba74;background:rgba(246,130,31,.08);border:1px solid rgba(246,130,31,.22);border-radius:8px;padding:5px 9px;margin-bottom:10px}
.bars{position:relative;display:grid;grid-template-columns:repeat(15,1fr);align-items:end;gap:4px;height:50px}
.bar{height:calc(var(--h) * 1%);border-radius:3px 3px 1px 1px;background:rgba(148,163,184,.1);transition:background .2s}
.bar.ok{background:linear-gradient(180deg,#34d399,#059669);box-shadow:0 0 12px -4px #34d399}
.bar.blocked{background:linear-gradient(180deg,#fb923c,#dc2626);box-shadow:0 0 12px -4px #fb923c}
.bar.err{background:#475569}
.limit{position:absolute;left:0;right:0;bottom:calc(var(--lim) * 1%);border-top:1px dashed rgba(251,191,36,.75);pointer-events:none}
.limit span{position:absolute;left:0;bottom:3px;font:500 10.5px var(--mono);color:var(--amber);background:rgba(4,7,14,.85);padding:0 4px;border-radius:4px}
.rl-summary{font-size:12px;line-height:1.45;color:var(--muted);padding:8px 0;min-height:34px}
.rl-summary b{color:var(--text)}.rl-summary a{color:var(--blue2)}

/* sub pages */
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.page-head h1{font-size:30px;margin:0 0 6px}.page-head p{margin:0;color:var(--muted);max-width:720px}
.actions{display:flex;gap:10px;flex-wrap:wrap}
.btn-ghost{flex:none;height:36px;padding:0 14px;background:rgba(15,21,36,.7);border:1px solid var(--line2);color:var(--text);font-size:13px}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}
.stat{padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:rgba(10,14,25,.6);min-width:0}
.stat small{display:block;color:var(--muted);font-size:12px;margin-bottom:4px}
.stat b{display:block;font:500 14px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.box{border:1px solid var(--line);border-radius:14px;background:rgba(10,14,25,.6);overflow:hidden;margin-bottom:18px}
.box-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 18px;border-bottom:1px solid var(--line)}
.box-head h2{margin:0;font-size:15px}.box-head p{margin:2px 0 0;color:var(--muted);font-size:12.5px}
.legend{display:flex;gap:8px;flex-wrap:wrap}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-weight:600;padding:10px 18px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:10px 18px;border-bottom:1px solid rgba(148,163,184,.07);vertical-align:top;font-size:13px}
tr:last-child td{border-bottom:0}
td.v{font:12.5px var(--mono);word-break:break-all}td.k{font:500 12.5px var(--mono);white-space:nowrap}
.src{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:500;white-space:nowrap;border:1px solid}
.src-cf{color:#fdba74;border-color:rgba(246,130,31,.35);background:rgba(246,130,31,.08)}
.src-nginx{color:#5eead4;border-color:rgba(45,212,191,.35);background:rgba(45,212,191,.08)}
.src-tunnel{color:#c4b5fd;border-color:rgba(139,92,246,.4);background:rgba(139,92,246,.1)}
.src-client{color:#cbd5e1;border-color:rgba(148,163,184,.25);background:rgba(148,163,184,.06)}
tr.hl-cf td.k{color:#fdba74}tr.hl-nginx td.k{color:#5eead4}tr.hl-tunnel td.k{color:#c4b5fd}
.status{font:600 12px var(--mono)}.s2{color:var(--green)}.s4{color:var(--amber)}.s5{color:var(--red)}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.dl{margin:0;padding:6px 18px 12px}
.dl>div{display:grid;grid-template-columns:180px minmax(0,1fr);gap:16px;padding:10px 0;border-bottom:1px dashed rgba(148,163,184,.1);font-size:13px}
.dl>div:last-child{border-bottom:0}.dl dt{color:var(--muted)}.dl dd{margin:0;word-break:break-all}
.meter{height:6px;border-radius:99px;background:rgba(148,163,184,.12);overflow:hidden;margin-top:8px}
.meter i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#2dd4bf,#34d399)}
.hops{padding:6px 18px 14px}
.hop{display:grid;grid-template-columns:34px minmax(0,1fr);gap:14px;padding:12px 0;border-bottom:1px dashed rgba(148,163,184,.1)}
.hop:last-child{border-bottom:0}
.hop .n{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font:600 13px var(--mono);background:rgba(45,212,191,.1);color:var(--teal);border:1px solid rgba(45,212,191,.3)}
.hop b{display:block;font-size:14px}.hop p{margin:2px 0 0;color:var(--muted);font-size:13px}
.check{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(148,163,184,.07)}
.check:last-child{border-bottom:0}.check .i{font-size:18px}.check b{font-size:13.5px}.check .d{margin-left:auto;color:var(--muted);font:12.5px var(--mono);text-align:right}
.toggle{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:13px;cursor:pointer}
.empty{padding:28px 18px;color:var(--muted);text-align:center}

@media (max-width:1380px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:1120px){.hero{grid-template-columns:1fr}.flow{flex-wrap:wrap}.flow .arrow,.flow-title{display:none}.step{flex:1 1 200px}.grid2{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:900px){
.sidebar{position:static;width:auto;flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:12px 16px;border-right:0;border-bottom:1px solid var(--line)}
.nav{flex-direction:row;flex-wrap:wrap;gap:4px;width:100%}.nav-label,.sys{display:none}.nav a{padding:7px 10px;font-size:13px}.nav a .i{font-size:16px}
.main{margin-left:0}.topbar{position:static;padding:10px 16px;flex-wrap:wrap}.content{padding:20px 16px 32px}
.cards{grid-template-columns:1fr}.user-name,.crumbs .zone,.crumbs .slash{display:none}
.pop{position:fixed;left:16px;right:16px;top:auto;width:auto}
.dl>div{grid-template-columns:1fr;gap:2px}.stats{grid-template-columns:1fr}
.map-legend{justify-content:flex-start}}
@media (prefers-reduced-motion:reduce){*,*::before{animation:none!important;transition:none!important}}
`;

/* ---------- shared client script ---------- */
const SHELL_JS = `
document.addEventListener('click',function(e){document.querySelectorAll('details.menu[open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open')})});
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('details.menu[open]').forEach(function(d){d.removeAttribute('open')})});
document.querySelectorAll('details.menu').forEach(function(d){d.addEventListener('toggle',function(){if(d.open)document.querySelectorAll('details.menu[open]').forEach(function(o){if(o!==d)o.removeAttribute('open')})})});
document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){
  var v=b.getAttribute('data-copy');var src=v.charAt(0)==='#'?document.querySelector(v):null;
  navigator.clipboard.writeText(src?src.textContent:v).then(function(){b.classList.add('done');setTimeout(function(){b.classList.remove('done')},1400)})})});
`;

/* ---------- layout ---------- */
const NAV = [
  ["home", "/", "Home"],
  ["requests", "/headers", "Requests"],
  ["cert", "/certificates", "Certificates"],
  ["logs", "/logs", "Logs"],
  ["settings", "/settings", "Settings"],
];

function sidebar(ctx, active) {
  const h = ctx.health;
  return `<aside class="sidebar">
  <a class="brand" href="/"><span class="logo">${LOGO}</span><span><b>SiamPay</b><small>Edge Console</small></span></a>
  <nav class="nav" aria-label="Console">
    <div class="nav-label">Console</div>
    ${NAV.map(([ic, href, label]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`).join("")}
  </nav>
  <a class="sys${h.healthy ? "" : " warn"}" href="/settings#health" title="${esc(h.checks.map((c) => `${c.ok ? "✓" : "!"} ${c.name}: ${c.detail}`).join("\n"))}">
    <span class="pulse"></span>
    <span><b>${h.healthy ? "System Healthy" : "Attention needed"}</b><small>${h.healthy ? "All services operational" : esc(h.checks.filter((c) => !c.ok).map((c) => c.name).join(", "))}</small></span>
  </a>
</aside>`;
}

function topbar(ctx, crumb) {
  return `<header class="topbar">
  <div class="crumbs"><span class="zone">${icon("cloud")}strikemap.space</span><span class="slash">/</span><b>${esc(crumb)}</b></div>
  <div class="controls">
    <details class="menu">
      <summary class="chip" aria-label="Request location">${flagImg(ctx)}<span>${esc(ctx.country || "—")}</span>${icon("chevron", "chev")}</summary>
      <div class="pop">
        <h4>This request, as seen by Cloudflare</h4>
        <div class="row"><span>Country · cf-ipcountry</span><b>${esc(ctx.country || "—")}</b></div>
        <div class="row"><span>Edge location · cf-ray</span><b>${esc(ctx.colo || "—")}</b></div>
        <div class="row"><span>Client IP · cf-connecting-ip</span><b>${esc(ctx.ip || "—")}</b></div>
        <div class="row"><span>Path to origin</span><b>${esc(ctx.via === "tunnel" ? "Cloudflare Tunnel" : ctx.via === "proxy" ? "Proxy → Nginx" : "Direct")}</b></div>
        <div class="note">Set by Cloudflare on every request. Connect from another country (e.g. a VPN) and it changes.</div>
      </div>
    </details>
    <details class="menu">
      <summary class="chip" aria-label="Presenter menu"><span class="avatar">DH</span><span class="user-name">Darshan Hegde</span>${icon("chevron", "chev")}</summary>
      <div class="pop">
        <h4>Presenter</h4>
        <a class="item" href="${PORTAL_URL}">${icon("key")}Staff portal (Cloudflare Access)</a>
        <a class="item" href="${REPO_URL}" target="_blank" rel="noopener">${icon("external")}Source on GitHub</a>
        <a class="item" href="/settings">${icon("settings")}Edge configuration</a>
      </div>
    </details>
  </div>
</header>`;
}

function shell({ ctx, title, active, crumb, body, script = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · SiamPay Edge Console</title>
<meta name="description" content="SiamPay Edge Console — a fictional Thai fintech origin on AWS EC2, delivered through Cloudflare.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>${CSS}</style>
</head>
<body>
${sidebar(ctx, active)}
<div class="main">
${topbar(ctx, crumb)}
<main class="content">
${body}
</main>
</div>
<script>${SHELL_JS}${script}</script>
</body>
</html>`;
}

/* ---------- world map ---------- */
const ROUTES = ["LHR", "FRA", "DXB", "JNB", "BOM", "HKG", "NRT", "SEA", "SJC", "SYD"];
function arcPath([x1, y1], [x2, y2], k = 0.22) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  let nx = -dy / len, ny = dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; } // always bulge north
  return `M${x1} ${y1}Q${(mx + nx * len * k).toFixed(1)} ${(my + ny * len * k).toFixed(1)} ${x2} ${y2}`;
}
const MAP_ROUTES = ROUTES.map((c, i) => ({ c, d: arcPath(MAP.cities[c], MAP.cities.SIN), dur: (3.2 + (i % 4) * 0.45).toFixed(2), delay: (i * 0.53).toFixed(2) }));

function worldMap(ctx) {
  const [sx, sy] = MAP.cities.SIN;
  const colo = ctx.colo && MAP.cities[ctx.colo] && ctx.colo !== "SIN" ? MAP.cities[ctx.colo] : null;
  return `<svg viewBox="0 0 ${MAP.width} ${MAP.height}" role="img" aria-labelledby="map-t">
  <title id="map-t">Cloudflare edge locations routing requests to the SiamPay origin in Singapore (AWS ap-southeast-1)</title>
  <defs>
    <radialGradient id="sinGlow"><stop offset="0" stop-color="#f6821f" stop-opacity=".55"/><stop offset=".45" stop-color="#f6821f" stop-opacity=".16"/><stop offset="1" stop-color="#f6821f" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g class="dots">
    <path d="${MAP.dots.far}" stroke="#27385c"/>
    <path d="${MAP.dots.mid}" stroke="#36517f"/>
    <path d="${MAP.dots.near}" stroke="#5a7cbd"/>
  </g>
  <g>${MAP_ROUTES.map((r) => `<path class="route" d="${r.d}"/>`).join("")}</g>
  <g filter="url(#glow)">${MAP_ROUTES.map((r) => `<path class="trail" pathLength="100" d="${r.d}" style="--dur:${r.dur}s;--delay:${r.delay}s"/>`).join("")}</g>
  <g>${ROUTES.map((c) => { const [x, y] = MAP.cities[c]; return `<circle class="pop-ring" cx="${x}" cy="${y}" r="5"/><circle class="pop-node" cx="${x}" cy="${y}" r="2.3"/>`; }).join("")}</g>
  ${colo ? `<circle cx="${colo[0]}" cy="${colo[1]}" r="7" fill="none" stroke="#86efac" stroke-width="1.2"/>` : ""}
  <path class="aws-link" d="M${sx} ${sy}L${sx - 14} ${sy + 34}"/>
  <g transform="translate(${sx - 134} ${sy + 34})">
    <rect width="122" height="40" rx="9" fill="rgba(10,14,25,.94)" stroke="rgba(255,153,0,.5)"/>
    <rect x="10" y="12" width="16" height="16" rx="4" fill="rgba(255,153,0,.16)" stroke="#ff9900" stroke-width=".8"/>
    <text class="svg-label" x="13.5" y="23.5" font-size="8.5" font-weight="700" fill="#ffb347">EC2</text>
    <text class="svg-label" x="34" y="18" font-size="11" font-weight="600" fill="#e7ecf6">AWS origin</text>
    <text class="svg-label" x="34" y="31" font-size="9.5" fill="#94a0b8">ap-southeast-1</text>
  </g>
  <circle cx="${sx}" cy="${sy}" r="34" fill="url(#sinGlow)"/>
  <circle class="sin-pulse" cx="${sx}" cy="${sy}" r="8"/>
  <circle cx="${sx}" cy="${sy}" r="4.6" fill="#fff" stroke="#f6821f" stroke-width="2.2"/>
  <g transform="translate(${sx + 14} ${sy - 12})">
    <rect width="118" height="24" rx="12" fill="rgba(10,14,25,.94)" stroke="rgba(34,197,94,.45)"/>
    <circle cx="13" cy="12" r="3.4" fill="#22c55e"/>
    <text class="svg-label" x="23" y="16" font-size="11" font-weight="600" fill="#e7ecf6">Singapore (SIN)</text>
  </g>
</svg>`;
}

/* ---------- pages ---------- */
function home(ctx) {
  const cert = ctx.cert;
  const tunnelReady = ctx.tunnel && ctx.tunnel.ready > 0;
  const onEdgeHost = ctx.host === EDGE_HOST;
  const body = `
<section class="hero">
  <div>
    <p class="eyebrow">Secure <span class="sep"></span> Fast <span class="sep"></span> Global</p>
    <h1>SiamPay <span class="grad">Edge Console</span></h1>
    <p class="lede">Fictional Thai fintech · Origin on <strong>AWS EC2 (ap-southeast-1)</strong><br>delivered through <strong>Cloudflare</strong></p>
    <div class="pills">
      <span class="pill"><span class="k">This request:</span><code>${esc(rayText(ctx))}</code>${ctx.ray ? `<button class="iconbtn" data-copy="${esc(ctx.ray)}" aria-label="Copy Ray ID">${icon("copy")}</button>` : ""}</span>
      <span class="pill plain">${flagImg(ctx)}<span class="k">Country</span><b>${esc(ctx.country || "—")}</b></span>
    </div>
  </div>
  <div class="map">
    <div class="map-top"><span>Cloudflare global network</span><span class="live"><i></i>${ctx.colo ? `This request via ${esc(ctx.colo)}` : "Direct to origin"}</span></div>
    ${worldMap(ctx)}
    <div class="map-legend"><span class="lg"><span class="d"></span>Cloudflare edge</span><span class="lg"><span class="l"></span>Requests to origin</span><span class="lg"><span class="s"></span>AWS ap-southeast-1</span></div>
  </div>
</section>

<section class="flow" aria-label="Request path">
  <span class="flow-title">Request path</span>
  <div class="step users"><span class="ic">${icon("users")}</span><span><b>Users</b><small>Browsers &amp; partner APIs</small></span></div>
  <span class="arrow">${icon("arrow")}</span>
  <div class="step cf"><span class="ic">${icon("cloud")}</span><span><b>Cloudflare edge</b><small>${ctx.colo ? `Served by ${esc(ctx.colo)} · anycast` : "Anycast network"}</small></span></div>
  <span class="arrow">${icon("arrow")}</span>
  <div class="step sec"><span class="ic">${icon("shield")}</span><span><b>Security</b><small>TLS · Rate limit · Access</small></span></div>
  <span class="arrow">${icon("arrow")}</span>
  <div class="step aws"><span class="ic">${icon("server")}</span><span><b>AWS EC2 origin</b><small>ap-southeast-1 · ${esc(ctx.via === "tunnel" ? "via Tunnel" : "Nginx")}</small></span></div>
  <span class="arrow">${icon("arrow")}</span>
  <div class="step app"><span class="ic">${icon("card")}</span><span><b>SiamPay app</b><small>Node.js ${esc(process.version)}</small></span></div>
</section>

<section class="cards">
  <article class="card c-blue">
    <div class="card-head"><span class="tile">${icon("search")}</span><h2>Request Inspector</h2></div>
    <p class="desc">Partners debug integrations by seeing exactly what reached our origin.</p>
    <div class="panel"><dl class="kv">
      <div><dt>Origin</dt><dd>AWS EC2 (ap-southeast-1)</dd></div>
      <div><dt>Via</dt><dd>${ctx.ray ? `Cloudflare<span class="badge">${esc(ctx.colo)}</span>` : "Direct (not proxied)"}</dd></div>
      <div><dt>Country</dt><dd>${esc(ctx.country || "—")}</dd></div>
      <div><dt>Request ID</dt><dd class="mono" title="${esc(rayText(ctx))}">${esc(ctx.ray || "—")}</dd></div>
    </dl></div>
    <div class="card-foot">
      <a class="btn btn-blue" href="/headers">Inspect my request ${icon("arrow")}</a>
      <a class="round" href="https://developers.cloudflare.com/fundamentals/reference/http-headers/" target="_blank" rel="noopener" title="Cloudflare docs: HTTP headers" aria-label="Cloudflare docs: HTTP headers">${icon("book")}</a>
    </div>
  </article>

  <article class="card c-teal">
    <div class="card-head"><span class="tile">${icon("lock")}</span><h2>Full (strict) TLS</h2></div>
    <p class="desc">Browser → Cloudflare → origin is HTTPS end to end, validated against a Let's Encrypt certificate.</p>
    <div class="panel">
      <div class="feat"><span class="fi">${icon("check")}</span><span><b>TLS Encryption</b><span class="ok-text">Enabled (Full strict)</span></span></div>
      <div class="feat"><span class="fi">${icon("lock")}</span><span><b>Certificate Authority</b><span>${esc(cert ? cert.issuerOrg : "Unavailable")}</span></span></div>
      <div class="feat"><span class="fi">${icon("shield")}</span><span><b>Validation</b><span class="${cert && cert.daysLeft > 7 ? "ok-text" : "warn-text"}">${cert ? `Trusted &amp; Valid · ${cert.daysLeft} days left` : "Unavailable"}</span></span></div>
      <div class="feat"><span class="fi">${icon("link")}</span><span><b>Protocol · edge → origin</b><span>${esc(originTlsText(ctx))}</span></span></div>
    </div>
    <div class="card-foot">
      <a class="btn btn-teal" href="/certificates">View TLS details ${icon("arrow")}</a>
      <a class="round" href="https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/" target="_blank" rel="noopener" title="Cloudflare docs: Full (strict)" aria-label="Cloudflare docs: Full (strict)">${icon("book")}</a>
    </div>
  </article>

  <article class="card c-orange">
    <div class="card-head"><span class="tile">${icon("gauge")}</span><h2>Rate limiting</h2><span class="tag">WAF rule</span></div>
    <p class="desc">Bursts against <code>/headers</code> are blocked at the edge before they reach the origin.</p>
    <div class="panel">
      <div class="rl-state"><span class="pulse"></span><span><b>Active Protection</b><small>Blocking malicious bursts</small></span></div>
      <div class="rule" title="5 requests per 10 seconds per IP and data center; then HTTP 429 for 60 seconds">5 req / 10 s / IP → 429 for 60 s</div>
      <div class="bars" id="bars" style="--lim:${((5 / 15) * 100).toFixed(1)}" aria-hidden="true">
        ${Array.from({ length: 15 }, (_, i) => `<i class="bar" style="--h:${(((i + 1) / 15) * 100).toFixed(1)}"></i>`).join("")}
        <div class="limit"><span>limit 5</span></div>
      </div>
      <div class="rl-summary" id="rl-summary" aria-live="polite">${onEdgeHost ? "Each bar is one request. Run a burst to see which ones the edge blocks." : `The rule is scoped to <b>${EDGE_HOST}</b>.`}</div>
    </div>
    <div class="card-foot">
      ${onEdgeHost
        ? `<button class="btn btn-orange" id="burst" type="button">Send 15 requests ${icon("arrow")}</button>`
        : `<a class="btn btn-orange" href="https://${EDGE_HOST}/">Open on ${EDGE_HOST} ${icon("arrow")}</a>`}
      <a class="round" href="https://developers.cloudflare.com/waf/rate-limiting-rules/" target="_blank" rel="noopener" title="Cloudflare docs: Rate limiting rules" aria-label="Cloudflare docs: Rate limiting rules">${icon("book")}</a>
    </div>
  </article>

  <article class="card c-purple">
    <div class="card-head"><span class="tile">${icon("users")}</span><h2>Staff portal</h2><span class="tag">Zero Trust</span></div>
    <p class="desc">Internal tool behind Cloudflare Tunnel + Access. No inbound ports, identity-aware.</p>
    <div class="panel">
      <div class="feat"><span class="fi">${icon("lock")}</span><span><b>Access</b><span>Cloudflare Access</span></span><em class="meta">OTP</em></div>
      <div class="feat"><span class="fi">${icon("network")}</span><span><b>Network</b><span>Private (Tunnel)</span></span>${ctx.tunnel ? `<em class="meta ${tunnelReady ? "ok" : "bad"}" title="Active cloudflared connections to the Cloudflare edge">${tunnelReady ? `● ${ctx.tunnel.ready} live` : "down"}</em>` : ""}</div>
      <div class="feat"><span class="fi">${icon("user")}</span><span><b>Identity</b><span>Validated</span></span><em class="meta" title="The Worker verifies the Cloudflare Access JWT on every request">JWT per request</em></div>
    </div>
    <div class="card-foot">
      <a class="btn btn-purple" href="${PORTAL_URL}">Open secure portal ${icon("arrow")}</a>
      <a class="round" href="https://developers.cloudflare.com/cloudflare-one/" target="_blank" rel="noopener" title="Cloudflare docs: Zero Trust" aria-label="Cloudflare docs: Zero Trust">${icon("book")}</a>
    </div>
  </article>
</section>`;

  const script = onEdgeHost ? `
(function(){
  var btn=document.getElementById('burst');if(!btn)return;
  var bars=[].slice.call(document.querySelectorAll('#bars .bar'));var out=document.getElementById('rl-summary');
  var label=btn.innerHTML;var timer=null;
  btn.addEventListener('click',async function(){
    if(btn.disabled)return;btn.disabled=true;clearInterval(timer);
    bars.forEach(function(b){b.className='bar'});
    var ok=0,blocked=0,other=0;
    for(var i=0;i<15;i++){
      btn.textContent='Sending… '+(i+1)+'/15';
      var s=0;try{var r=await fetch('/headers?format=json&burst='+(i+1),{cache:'no-store',headers:{accept:'application/json'}});s=r.status}catch(e){}
      if(s===200){ok++;bars[i].className='bar ok'}else if(s===429){blocked++;bars[i].className='bar blocked'}else{other++;bars[i].className='bar err'}
    }
    out.innerHTML='<b>'+ok+'</b> reached origin · <b>'+blocked+'</b> blocked (429)'+(other?' · '+other+' failed':'')+
      '<br><span id="rl-cd">'+(blocked?'Edge block active':'No blocks')+'</span> · <a href="/logs">origin log →</a>';
    btn.disabled=false;btn.innerHTML=label;
    if(blocked){var left=60,cd=document.getElementById('rl-cd');timer=setInterval(function(){left--;
      cd.textContent=left>0?'Blocked on /headers for ~'+left+'s':'Block expired';if(left<=0)clearInterval(timer)},1000)}
  });
})();` : "";
  return shell({ ctx, title: "Home", active: "/", crumb: "Home", body, script });
}

function classify(name, via) {
  if (name === "cf-warp-tag-id" || (via === "tunnel" && name === "cf-access-jwt-assertion")) return ["tunnel", "Cloudflare Tunnel"];
  if (name.startsWith("cf-") || ["cdn-loop", "x-forwarded-for", "true-client-ip"].includes(name)) return ["cf", "Cloudflare"];
  if (via !== "tunnel" && ["x-origin-tls-protocol", "x-origin-tls-cipher", "x-forwarded-proto", "connection"].includes(name)) return ["nginx", "Nginx (origin)"];
  return ["client", "Browser / client"];
}

function requests(ctx, headers) {
  const rows = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
    const [cls, label] = classify(k, ctx.via);
    return `<tr class="hl-${cls}"><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td><td><span class="src src-${cls}">${label}</span></td></tr>`;
  }).join("");
  const body = `
<div class="page-head">
  <div><h1>Requests</h1><p>Every header the origin received for <b>this</b> request, and which hop added it. This endpoint is also the rate-limit target.</p></div>
  <div class="actions">
    <a class="btn btn-ghost" href="/headers?format=json">${icon("external")}JSON</a>
    <button class="btn btn-ghost" type="button" data-copy="#hdr-json">${icon("copy")}Copy as JSON</button>
    <a class="btn btn-ghost" href="/headers">${icon("activity")}Refresh</a>
  </div>
</div>
<div class="stats">
  <div class="stat"><small>Ray ID · cf-ray</small><b>${esc(ctx.ray || "—")}</b></div>
  <div class="stat"><small>Edge location</small><b>${esc(ctx.colo || "—")}</b></div>
  <div class="stat"><small>Country · cf-ipcountry</small><b>${esc(ctx.country || "—")}</b></div>
  <div class="stat"><small>Edge → origin</small><b>${esc(ctx.via === "tunnel" ? "Cloudflare Tunnel" : ctx.via === "proxy" ? `HTTPS · ${originTlsText(ctx)}` : "Direct")}</b></div>
</div>
<div class="box">
  <div class="box-head"><div><h2>Request headers</h2><p>${Object.keys(headers).length} headers received by the origin</p></div>
    <div class="legend"><span class="src src-cf">Cloudflare</span><span class="src src-nginx">Nginx (origin)</span><span class="src src-tunnel">Cloudflare Tunnel</span><span class="src src-client">Browser / client</span></div></div>
  <div class="table-wrap"><table><thead><tr><th>Header</th><th>Value</th><th>Added by</th></tr></thead><tbody>${rows}</tbody></table></div>
</div>
<script type="application/json" id="hdr-json">${JSON.stringify(headers, null, 2).replace(/</g, "\\u003c")}</script>`;
  return shell({ ctx, title: "Requests", active: "/headers", crumb: "Requests", body });
}

function certificates(ctx) {
  const c = ctx.cert, e = ctx.edgeCert;
  const life = c ? Math.max(0, Math.min(100, (c.daysLeft / c.totalDays) * 100)) : 0;
  const body = `
<div class="page-head"><div><h1>Certificates</h1><p>Encryption on every hop between the browser and the SiamPay origin, read live from the certificates in use.</p></div></div>
<div class="grid2">
  <div class="box">
    <div class="box-head"><div><h2>Origin certificate</h2><p>Presented by Nginx on EC2; validated by Cloudflare in Full (strict) mode</p></div><span class="src src-nginx">Let's Encrypt · not Cloudflare-issued</span></div>
    ${c ? `<dl class="dl">
      <div><dt>Subject</dt><dd class="mono">${esc(c.subjectCN)}</dd></div>
      <div><dt>Subject alt names</dt><dd class="mono">${esc(c.san)}</dd></div>
      <div><dt>Issuer</dt><dd>${esc(c.issuerOrg)} <span class="muted">· ${esc(c.issuerCN)}</span></dd></div>
      <div><dt>Valid</dt><dd>${esc(fmtDate(c.validFrom))} → ${esc(fmtDate(c.validTo))}<div class="meter"><i style="width:${life.toFixed(1)}%"></i></div><small class="muted">${c.daysLeft} of ${c.totalDays} days remaining</small></dd></div>
      <div><dt>Key</dt><dd>${esc(keyLabel(c))}</dd></div>
      <div><dt>Serial</dt><dd class="mono">${esc(c.serial)}</dd></div>
      <div><dt>SHA-256 fingerprint</dt><dd class="mono">${esc(c.fingerprint)}</dd></div>
      <div><dt>Issued via</dt><dd>ACME DNS-01 challenge on Cloudflare DNS — port 80 never opened</dd></div>
    </dl>` : `<div class="empty">Origin certificate could not be read.</div>`}
  </div>
  <div>
    <div class="box">
      <div class="box-head"><div><h2>Encryption path</h2><p>What protects each hop</p></div></div>
      <div class="hops">
        <div class="hop"><span class="n">1</span><div><b>Browser → Cloudflare edge</b><p>Edge certificate${e ? ` <span class="mono">${esc(e.subjectCN)}</span> issued by ${esc(e.issuerOrg)} (${esc(e.issuerCN)}), valid to ${esc(fmtDate(e.validTo))}` : " managed by Cloudflare (Universal SSL)"}. Always Use HTTPS · minimum TLS 1.2.</p></div></div>
        <div class="hop"><span class="n">2</span><div><b>Cloudflare → origin (app.strikemap.space)</b><p>Full (strict): Cloudflare requires a CA-trusted, unexpired certificate matching the hostname. This request: <span class="mono">${esc(ctx.via === "proxy" ? `${ctx.tlsProto || "?"} · ${ctx.tlsCipher || "?"}` : "n/a (not via proxy)")}</span></p></div></div>
        <div class="hop"><span class="n">3</span><div><b>Cloudflare → origin (tunnel.strikemap.space)</b><p>Cloudflare Tunnel: outbound-only encrypted connections from cloudflared on EC2${ctx.tunnel ? ` · <span class="${ctx.tunnel.ready > 0 ? "ok-text" : "warn-text"}">${ctx.tunnel.ready} active</span>` : ""}. No inbound port needed.</p></div></div>
      </div>
    </div>
  </div>
</div>`;
  return shell({ ctx, title: "Certificates", active: "/certificates", crumb: "Certificates", body });
}

function logRows(entries) {
  return entries.map((l) => `<tr><td class="k">${esc(l.t.slice(11, 19))}</td><td>${esc(l.host)}</td><td class="k">${esc(l.method)}</td><td class="v">${esc(l.path)}</td><td class="status s${String(l.status)[0]}">${l.status}</td><td class="k">${esc(l.colo || "—")}</td><td class="k">${esc(l.country || "—")}</td><td class="v">${esc(l.ray || "—")}</td></tr>`).join("");
}

function logs(ctx, entries) {
  const body = `
<div class="page-head">
  <div><h1>Logs</h1><p>Requests that actually reached the origin (last 100, in memory, UTC). Requests blocked at the Cloudflare edge — like the 429s from a rate-limit burst — never appear here.</p></div>
  <label class="toggle"><input type="checkbox" id="auto" checked> Auto-refresh every 3 s</label>
</div>
<div class="box">
  <div class="table-wrap"><table>
    <thead><tr><th>Time</th><th>Host</th><th>Method</th><th>Path</th><th>Status</th><th>Edge</th><th>Country</th><th>Ray ID</th></tr></thead>
    <tbody id="log-body">${entries.length ? logRows(entries) : `<tr><td colspan="8" class="empty">No requests logged yet.</td></tr>`}</tbody>
  </table></div>
</div>`;
  const script = `
(function(){
  var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})};
  var body=document.getElementById('log-body'),auto=document.getElementById('auto');
  async function tick(){
    if(!auto.checked||document.hidden)return;
    try{var r=await fetch('/logs.json',{cache:'no-store'});var d=await r.json();
      body.innerHTML=d.length?d.map(function(l){return '<tr><td class="k">'+esc(l.t.slice(11,19))+'</td><td>'+esc(l.host)+'</td><td class="k">'+esc(l.method)+'</td><td class="v">'+esc(l.path)+'</td><td class="status s'+esc(String(l.status).charAt(0))+'">'+esc(l.status)+'</td><td class="k">'+esc(l.colo||'—')+'</td><td class="k">'+esc(l.country||'—')+'</td><td class="v">'+esc(l.ray||'—')+'</td></tr>'}).join(''):'<tr><td colspan="8" class="empty">No requests logged yet.</td></tr>'}catch(e){}
  }
  setInterval(tick,3000);
})();`;
  return shell({ ctx, title: "Logs", active: "/logs", crumb: "Logs", body, script });
}

function settings(ctx) {
  const rows = (items) => `<dl class="dl">${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
  const body = `
<div class="page-head"><div><h1>Settings</h1><p>Read-only view of how Cloudflare and AWS are configured for this demo. Changes are made through the Cloudflare API / Wrangler and the AWS CLI.</p></div></div>
<div class="box" id="health">
  <div class="box-head"><div><h2>Health checks</h2><p>Evaluated by the origin just now</p></div><span class="src ${ctx.health.healthy ? "src-nginx" : "src-cf"}">${ctx.health.healthy ? "All passing" : "Attention needed"}</span></div>
  ${ctx.health.checks.map((c) => `<div class="check"><span class="${c.ok ? "ok-text" : "warn-text"}">${icon(c.ok ? "check" : "activity")}</span><b>${esc(c.name)}</b><span class="d">${esc(c.detail)}</span></div>`).join("")}
</div>
<div class="grid2">
  <div class="box"><div class="box-head"><div><h2>Cloudflare · application services</h2><p>Zone strikemap.space (Pro)</p></div></div>
    ${rows([
      ["DNS", '<span class="mono">app</span> A → EC2 Elastic IP, proxied · <span class="mono">tunnel</span> CNAME → Cloudflare Tunnel'],
      ["SSL/TLS", "Full (strict) · minimum TLS 1.2 · Always Use HTTPS"],
      ["Rate limiting", '<span class="mono">app.strikemap.space/headers</span> · 5 requests / 10 s per IP + data center · block 60 s with JSON 429'],
      ["Workers", '<span class="mono">siampay-staff-portal</span> on <span class="mono">tunnel.strikemap.space/secure*</span> · workers.dev disabled'],
      ["R2", '<span class="mono">cf-se-demo-flags</span> · private, reachable only via the Worker binding'],
    ])}</div>
  <div class="box"><div class="box-head"><div><h2>Cloudflare Zero Trust · AWS</h2><p>Team hegdedarsh.cloudflareaccess.com</p></div></div>
    ${rows([
      ["Tunnel", `<span class="mono">siampay-origin</span> → <span class="mono">http://localhost:8080</span>${ctx.tunnel ? ` · ${ctx.tunnel.ready} connections` : ""}`],
      ["Access app", '<span class="mono">tunnel.strikemap.space/secure</span> · allow: owner + any <span class="mono">@cloudflare.com</span> email'],
      ["Login methods", "One-time PIN"],
      ["Origin", "EC2 t3.micro · ap-southeast-1 · Ubuntu 24.04 · Nginx + Node.js"],
      ["Origin firewall", "Security group: 443 from Cloudflare IP ranges only · no port 80 · Node bound to 127.0.0.1"],
    ])}</div>
</div>`;
  return shell({ ctx, title: "Settings", active: "/settings", crumb: "Settings", body });
}

function notFound(ctx) {
  return shell({ ctx, title: "Not found", active: "", crumb: "Not found", body: `<div class="page-head"><div><h1>Not found</h1><p>That page doesn't exist. <a class="grad" href="/">Back to the console →</a></p></div></div>` });
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M21.5 10h-8a4 4 0 0 0 0 8h4a4 4 0 0 1 0 8h-8" transform="translate(0 -2)" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

module.exports = { home, requests, certificates, logs, settings, notFound, FAVICON };
