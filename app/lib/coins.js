// Market presentation helpers shared by the server-rendered pages. Values always come from lib/market.js.
const { esc } = require("./edge");

// Simple asset marks (not official logos) so each market is recognisable at a glance.
const ICONS = {
  BTC: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#F7931A"/><path fill="#fff" d="M21.6 14c.3-2-1.2-3-3.3-3.8l.7-2.7-1.6-.4-.7 2.6-1.3-.3.7-2.6-1.7-.4-.6 2.7-1-.3-2.3-.5-.4 1.7s1.2.3 1.2.3c.7.2.8.6.8 1l-1.8 7.4c-.1.2-.3.5-.8.4l-1.2-.3-.8 1.9 2.2.5 1.2.3-.7 2.8 1.6.4.7-2.7 1.3.3-.7 2.7 1.7.4.7-2.8c2.8.5 4.9.3 5.8-2.2.7-2-.1-3.2-1.5-4 1-.2 1.8-.9 2-2.3zm-3.8 5.3c-.5 2-3.9.9-5 .7l.9-3.6c1.1.3 4.6.8 4.1 2.9zm.5-5.4c-.5 1.8-3.3.9-4.2.7l.8-3.2c.9.2 3.9.6 3.4 2.5z"/></svg>`,
  ETH: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path fill="#fff" fill-opacity=".6" d="M16.5 4v8.9l7.5 3.3z"/><path fill="#fff" d="M16.5 4 9 16.2l7.5-3.3z"/><path fill="#fff" fill-opacity=".6" d="M16.5 22v6l7.5-10.4z"/><path fill="#fff" d="M16.5 28v-6L9 17.6z"/><path fill="#fff" fill-opacity=".2" d="m16.5 20.6 7.5-4.4-7.5-3.3z"/><path fill="#fff" fill-opacity=".6" d="m9 16.2 7.5 4.4v-7.7z"/></svg>`,
  SOL: `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="sol-g" x1="8" y1="24" x2="24" y2="8" gradientUnits="userSpaceOnUse"><stop stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="#101418"/><path fill="url(#sol-g)" d="M10.4 19.6h11.8l-2.6 2.6H7.8zm0-8.8h11.8l-2.6 2.6H7.8zm11.8 4.4H10.4l-2.6 2.6h11.8z"/></svg>`,
  BNB: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#F3BA2F"/><path fill="#fff" d="m12.1 14.3 3.9-3.9 3.9 3.9 2.3-2.3L16 5.8 9.8 12zm-6.3 1.7L8 13.7l2.3 2.3L8 18.3zm6.3 1.7 3.9 3.9 3.9-3.9 2.3 2.3-6.2 6.2-6.2-6.2zm9.6-1.7 2.3-2.3 2.3 2.3-2.3 2.3zm-3.4 0L16 13.7 13.7 16l2.3 2.3z"/></svg>`,
  XRP: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#23292F"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" d="M9 9l4.2 4.2a4 4 0 0 0 5.6 0L23 9M9 23l4.2-4.2a4 4 0 0 1 5.6 0L23 23"/></svg>`,
  ADA: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#0033AD"/><g fill="#fff"><circle cx="16" cy="16" r="3"/><circle cx="16" cy="8" r="1.5"/><circle cx="16" cy="24" r="1.5"/><circle cx="9.1" cy="12" r="1.5"/><circle cx="22.9" cy="12" r="1.5"/><circle cx="9.1" cy="20" r="1.5"/><circle cx="22.9" cy="20" r="1.5"/><circle cx="16" cy="4.5" r=".9"/><circle cx="16" cy="27.5" r=".9"/><circle cx="6" cy="10.3" r=".9"/><circle cx="26" cy="10.3" r=".9"/><circle cx="6" cy="21.7" r=".9"/><circle cx="26" cy="21.7" r=".9"/></g></svg>`,
};

const DASH = "—";
function fmtPrice(p) {
  if (!Number.isFinite(p)) return DASH;
  const d = p >= 1000 ? 2 : p >= 1 ? 2 : 4;
  return `$${p.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
const fmtChange = (c) => (Number.isFinite(c) ? `${c >= 0 ? "▲" : "▼"} ${Math.abs(c).toFixed(2)}%` : DASH);
const dir = (c) => (Number.isFinite(c) ? (c >= 0 ? "up" : "down") : "");
function fmtBig(v) {
  if (!Number.isFinite(v)) return DASH;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}
function fmtTime(iso) {
  if (!iso) return DASH;
  const t = new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${t} SGT`;
}

// Sparkline path in a w×h box from [[t, price], ...]; the same maths runs in public/app.js.
function sparkPath(points, w = 120, h = 36, pad = 2) {
  if (!points || points.length < 2) return "";
  const ts = points.map((p) => p[0]), ps = points.map((p) => p[1]);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const mid = (Math.min(...ps) + Math.max(...ps)) / 2, half = Math.max((Math.max(...ps) - Math.min(...ps)) / 2, mid * 0.0075); // floor: ±0.75%
  const lo = mid - half, hi = mid + half;
  const x = (t) => pad + ((t - t0) / (t1 - t0 || 1)) * (w - pad * 2);
  const y = (p) => h - pad - ((p - lo) / (hi - lo || 1)) * (h - pad * 2);
  return points.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join("");
}

const STATUS_TEXT = { live: "Live", delayed: "Market data delayed", unavailable: "Market data unavailable" };
const statusPill = (m) =>
  `<span class="mkt-state ${esc(m.status)}" data-mkt-state><i></i><span>${STATUS_TEXT[m.status] || "Market data delayed"}</span></span>`;

module.exports = { ICONS, fmtPrice, fmtChange, fmtBig, fmtTime, dir, sparkPath, statusPill, DASH };
