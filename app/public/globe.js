// NOVA hero globe: an orthographic globe of Natural Earth land points (public domain) with arcs converging on
// Singapore. Purely decorative: nothing drawn here is a measurement or a traffic figure.
(() => {
  const script = document.currentScript;
  const box = document.querySelector("[data-globe]");
  if (!box) return;
  const canvas = box.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RAD = Math.PI / 180;
  const C = [103, 10]; // view centre (lon, lat)
  const SG = [103.82, 1.35];
  const CITIES = [["London", -0.13, 51.51], ["New York", -74.0, 40.71], ["Tokyo", 139.69, 35.69], ["Sydney", 151.21, -33.87], ["Frankfurt", 8.68, 50.11], ["Dubai", 55.27, 25.2], ["Mumbai", 72.88, 19.08], ["Hong Kong", 114.17, 22.32], ["Seoul", 126.98, 37.57], ["Perth", 115.86, -31.95], ["Jakarta", 106.85, -6.21]];
  const LABELS = new Set(["London", "New York", "Tokyo", "Sydney"]);
  let dots = null, W = 0, H = 0, r = 0, cx = 0, cy = 0, dpr = 1, base = null, arcs = [], labels = [];

  const sinP0 = Math.sin(C[1] * RAD), cosP0 = Math.cos(C[1] * RAD);
  function project(lon, lat) {
    const l = (lon - C[0]) * RAD, p = lat * RAD;
    const cosc = sinP0 * Math.sin(p) + cosP0 * Math.cos(p) * Math.cos(l);
    const x = Math.cos(p) * Math.sin(l);
    const y = cosP0 * Math.sin(p) - sinP0 * Math.cos(p) * Math.cos(l);
    return [cx + r * x, cy - r * y, cosc];
  }
  const vec = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
  function slerp(a, b, t) {
    const d = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    const s = Math.sin(d) || 1, k1 = Math.sin((1 - t) * d) / s, k2 = Math.sin(t * d) / s;
    const v = [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
    return [Math.atan2(v[1], v[0]) / RAD, Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD, d];
  }

  function layout() {
    const rect = box.getBoundingClientRect();
    W = Math.round(rect.width); H = Math.round(rect.height);
    if (!W || !H) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    r = Math.min(W, H) * 0.44; cx = W * 0.54; cy = H * 0.5; // glow (1.12r) stays inside the canvas
    return true;
  }

  function renderBase() {
    base = document.createElement("canvas");
    base.width = W * dpr; base.height = H * dpr;
    const g = base.getContext("2d");
    g.scale(dpr, dpr);
    const atm = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.12);
    atm.addColorStop(0, "rgba(246,130,31,0.20)"); atm.addColorStop(0.35, "rgba(246,130,31,0.06)"); atm.addColorStop(1, "rgba(246,130,31,0)");
    g.fillStyle = atm; g.beginPath(); g.arc(cx, cy, r * 1.12, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r * 1.02);
    body.addColorStop(0, "#1b1f26"); body.addColorStop(0.6, "#0e1116"); body.addColorStop(1, "#07080a");
    g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,170,90,0.18)"; g.lineWidth = 1; g.stroke();
    const s = Math.max(1.4, r / 190);
    for (let i = 0; i < dots.length; i += 3) {
      const [x, y, c] = project(dots[i] / 10, dots[i + 1] / 10);
      if (c <= 0.02) continue;
      const lit = dots[i + 2];
      if (lit > 0) {
        const a = Math.min(1, (0.35 + lit * 0.09) * (0.45 + 0.55 * c));
        g.fillStyle = `rgba(255,150,60,${(a * 0.22).toFixed(3)})`;
        g.beginPath(); g.arc(x, y, s * (1.6 + lit * 0.25), 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgba(255,${170 + lit * 8},${90 + lit * 10},${a.toFixed(3)})`;
        g.fillRect(x - s * 0.6, y - s * 0.6, s * 1.2, s * 1.2);
      } else {
        g.fillStyle = `rgba(165,172,186,${(0.16 + 0.42 * c).toFixed(3)})`;
        g.fillRect(x - s * 0.5, y - s * 0.5, s, s);
      }
    }
    const sheen = g.createRadialGradient(cx - r * 0.45, cy - r * 0.55, 0, cx - r * 0.45, cy - r * 0.55, r);
    sheen.addColorStop(0, "rgba(255,255,255,0.05)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sheen; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  }

  function buildArcs() {
    const to = vec(SG[0], SG[1]);
    arcs = CITIES.map(([name, lon, lat]) => {
      const from = vec(lon, lat);
      const span = slerp(from, to, 0)[2];
      const lift = Math.min(0.2, 0.08 + 0.34 * (span / Math.PI));
      const pts = [];
      for (let i = 0; i <= 90; i++) {
        const t = i / 90;
        const [plon, plat] = slerp(from, to, t);
        const [x, y, c] = project(plon, plat);
        const L = 1 + lift * Math.sin(Math.PI * t) * Math.min(1, c * 3); // hug the globe near the horizon
        const X = cx + (x - cx) * L, Y = cy + (y - cy) * L;
        if (c > 0.1) pts.push([X, Y]); else pts.length = 0; // only the visible hemisphere; restart after the horizon
      }
      return { name, pts };
    });
    labels.forEach((l) => l.remove());
    labels = [];
    for (const a of arcs) {
      if (!LABELS.has(a.name) || !a.pts.length) continue;
      const [lx, ly] = a.pts[0];
      labels.push(label(a.name, lx, ly, ""));
    }
    const [sx, sy] = project(SG[0], SG[1]);
    labels.push(label("Singapore", sx, sy, "sg"));
  }

  function label(text, x, y, cls) {
    const el = document.createElement("span");
    el.className = `g-label ${cls}`;
    el.textContent = text;
    el.style.left = `${Math.min(92, Math.max(8, (x / W) * 100)).toFixed(2)}%`;
    el.style.top = `${Math.min(94, Math.max(12, (y / H) * 100)).toFixed(2)}%`;
    box.appendChild(el);
    return el;
  }

  function frame(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    ctx.lineCap = "round";
    for (const [k, a] of arcs.entries()) {
      if (a.pts.length < 2) continue;
      ctx.beginPath();
      a.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = "rgba(246,130,31,0.5)"; ctx.lineWidth = 1.4; ctx.shadowColor = "rgba(246,130,31,0.8)"; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
      if (!reduced) {
        const n = a.pts.length, head = Math.floor((((t / 2600) + k * 0.37) % 1) * n), tail = Math.max(0, head - Math.floor(n * 0.22));
        const grad = ctx.createLinearGradient(a.pts[tail][0], a.pts[tail][1], a.pts[head][0], a.pts[head][1]);
        grad.addColorStop(0, "rgba(255,180,100,0)"); grad.addColorStop(1, "rgba(255,200,130,0.95)");
        ctx.beginPath();
        for (let i = tail; i <= head; i++) (i === tail ? ctx.moveTo : ctx.lineTo).call(ctx, a.pts[i][0], a.pts[i][1]);
        ctx.strokeStyle = grad; ctx.lineWidth = 2.2; ctx.stroke();
      }
      const [x0, y0] = a.pts[0];
      ctx.fillStyle = "rgba(255,190,120,0.9)"; ctx.beginPath(); ctx.arc(x0, y0, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    const [sx, sy] = project(SG[0], SG[1]);
    const pulse = reduced ? 0.5 : (t / 1800) % 1;
    ctx.strokeStyle = `rgba(246,130,31,${(0.8 * (1 - pulse)).toFixed(3)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, 5 + pulse * 18, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffb070"; ctx.shadowColor = "rgba(246,130,31,0.9)"; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(sx, sy, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }

  let raf = 0, visible = true;
  const loop = (t) => { frame(t); if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(loop); else raf = 0; };
  const kick = () => { if (!raf && base) raf = requestAnimationFrame(loop); };
  function rebuild() {
    if (!dots || !layout()) return;
    renderBase(); buildArcs();
    cancelAnimationFrame(raf); raf = 0; kick();
  }

  new ResizeObserver(() => rebuild()).observe(box);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(box);
  document.addEventListener("visibilitychange", kick);
  fetch(script?.dataset.dots || "/globe-dots.json").then((r) => r.json()).then((d) => { dots = d; rebuild(); }).catch(() => {});
})();
