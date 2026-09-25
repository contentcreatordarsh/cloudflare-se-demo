import { useEffect, useMemo, useRef, useState } from "react";
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import DOTS from "../data/globe-dots.json";
import { SINGAPORE, SOURCES } from "../data/demo";

const CENTER: [number, number] = [100, 12]; // view centred on 100°E, 12°N (Southeast Asia)
const HALF_PI = Math.PI / 2;
const dots = DOTS as number[];

interface Props {
  sgRtt: number | null; // measured browser <-> edge RTT when this browser is served by SIN
  originHealthy: boolean | null;
}

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function makeProjection(w: number, h: number) {
  const r = Math.min(w * 0.46, h * 0.8);
  return geoOrthographic().rotate([-CENTER[0], -CENTER[1]]).scale(r).translate([w * 0.5, h * 0.5]).clipAngle(90);
}

interface DotLayer { base: Float32Array; lit: Float32Array }
function projectDots(proj: GeoProjection): DotLayer {
  const center: [number, number] = [CENTER[0], CENTER[1]];
  const base: number[] = [], lit: number[] = [];
  for (let i = 0; i < dots.length; i += 3) {
    const ll: [number, number] = [dots[i] / 10, dots[i + 1] / 10];
    const d = geoDistance(ll, center);
    if (d > HALF_PI - 0.02) continue;
    const p = proj(ll);
    if (!p) continue;
    const limb = Math.cos(d); // 1 at centre, 0 at the limb
    base.push(p[0], p[1], 0.16 + 0.34 * limb);
    if (dots[i + 2] > 0) lit.push(p[0], p[1], dots[i + 2], limb);
  }
  return { base: Float32Array.from(base), lit: Float32Array.from(lit) };
}

function drawGlobe(ctx: CanvasRenderingContext2D, proj: GeoProjection, layer: DotLayer, w: number, h: number, t: number) {
  const [cx, cy] = proj.translate();
  const r = proj.scale();
  ctx.clearRect(0, 0, w, h);

  // atmosphere
  const atm = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.18);
  atm.addColorStop(0, "rgba(47,124,246,0.28)");
  atm.addColorStop(0.35, "rgba(47,124,246,0.10)");
  atm.addColorStop(1, "rgba(47,124,246,0)");
  ctx.fillStyle = atm;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2); ctx.fill();

  // sphere body
  const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  body.addColorStop(0, "#0d1d3a");
  body.addColorStop(0.55, "#07122a");
  body.addColorStop(1, "#040a17");
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(91,155,255,0.28)"; ctx.lineWidth = 1; ctx.stroke();

  // graticule
  const path = geoPath(proj, ctx);
  ctx.beginPath(); path(geoGraticule10());
  ctx.strokeStyle = "rgba(91,155,255,0.07)"; ctx.lineWidth = 0.6; ctx.stroke();

  // land dots
  const { base, lit } = layer;
  for (let i = 0; i < base.length; i += 3) {
    ctx.fillStyle = `rgba(104,146,228,${base[i + 2].toFixed(3)})`;
    ctx.fillRect(base[i] - 0.8, base[i + 1] - 0.8, 1.6, 1.6);
  }
  // city lights, gently twinkling
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0, k = 0; i < lit.length; i += 4, k++) {
    const x = lit[i], y = lit[i + 1], g = lit[i + 2], limb = lit[i + 3];
    const tw = 0.82 + 0.18 * Math.sin(t / 900 + k * 1.7);
    const a = (0.1 + g * 0.075) * (0.35 + 0.65 * limb) * tw;
    ctx.fillStyle = `rgba(255,186,102,${(a * 0.35).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, 1.8 + g * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,214,150,${Math.min(1, a * 1.6).toFixed(3)})`;
    ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
  }
  ctx.globalCompositeOperation = "source-over";

  // subtle sheen
  const sheen = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.55, 0, cx - r * 0.45, cy - r * 0.55, r * 0.9);
  sheen.addColorStop(0, "rgba(120,170,255,0.07)");
  sheen.addColorStop(1, "rgba(120,170,255,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

interface Arc { id: string; label: string; rtt: number; d: string; start: [number, number]; horizon: boolean }

function buildArcs(proj: GeoProjection): Arc[] {
  const [cx, cy] = proj.translate();
  const center: [number, number] = [CENTER[0], CENTER[1]];
  return SOURCES.map((s) => {
    const interp = geoInterpolate(s.ll, SINGAPORE);
    const span = geoDistance(s.ll, SINGAPORE);
    const lift = 0.05 + 0.2 * (span / Math.PI);
    const pts: [number, number][] = [];
    let horizon = false;
    for (let i = 0; i <= 72; i++) {
      const t = i / 72;
      const ll = interp(t) as [number, number];
      if (geoDistance(ll, center) > HALF_PI - 0.03) { horizon = true; pts.length = 0; continue; } // restart after the horizon
      const p = proj(ll);
      if (!p) continue;
      const L = 1 + lift * Math.sin(Math.PI * t);
      pts.push([cx + (p[0] - cx) * L, cy + (p[1] - cy) * L]);
    }
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
    return { id: s.id, label: s.label, rtt: s.rtt, d, start: pts[0] ?? [cx, cy], horizon };
  });
}

export function Globe({ sgRtt, originHealthy }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { w, h } = useSize(wrap);
  const proj = useMemo(() => (w && h ? makeProjection(w, h) : null), [w, h]);
  const arcs = useMemo(() => (proj ? buildArcs(proj) : []), [proj]);
  const layer = useMemo(() => (proj ? projectDots(proj) : null), [proj]);
  const sg = proj ? (proj(SINGAPORE) as [number, number]) : null;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !proj || !layer || !w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    drawGlobe(ctx, proj, layer, w, h, 0);
    if (reduce) return;
    let raf = 0, last = 0;
    const loop = (t: number) => {
      if (t - last > 120 && !document.hidden) { last = t; drawGlobe(ctx, proj, layer, w, h, t); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [proj, layer, w, h]);

  const clampX = (x: number, bw: number) => Math.max(4, Math.min(w - bw - 4, x));
  const clampY = (y: number, bh: number) => Math.max(4, Math.min(h - bh - 4, y));

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden [mask-image:linear-gradient(to_bottom,black_82%,transparent)]">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
      {proj && sg && (
        <svg className="absolute inset-0" width={w} height={h} role="img" aria-label="Traffic from Europe, India, Japan, Australia and the US converging on the Cloudflare edge in Singapore, next to the AWS origin in ap-southeast-1">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <radialGradient id="sg-glow"><stop offset="0" stopColor="#f6821f" stopOpacity=".75" /><stop offset=".4" stopColor="#f6821f" stopOpacity=".22" /><stop offset="1" stopColor="#f6821f" stopOpacity="0" /></radialGradient>
            <linearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5b9bff" stopOpacity=".25" /><stop offset="1" stopColor="#22d3ee" stopOpacity=".6" /></linearGradient>
          </defs>

          {arcs.map((a) => <path key={`b-${a.id}`} d={a.d} fill="none" stroke="rgba(91,155,255,0.38)" strokeWidth={1.1} />)}
          <g filter="url(#glow)">
            {arcs.map((a, i) => (
              <path key={`t-${a.id}`} d={a.d} pathLength={100} fill="none" stroke="#67e8f9" strokeWidth={2} strokeLinecap="round"
                className="trail" style={{ ["--dur" as string]: `${3 + (i % 3) * 0.6}s`, ["--delay" as string]: `${i * 0.7}s` }} />
            ))}
          </g>

          {arcs.map((a) => {
            const [x, y] = a.start;
            const bw = 58, bh = 34;
            const bx = clampX(x + (x < sg[0] ? -bw - 8 : 8), bw);
            const by = clampY(y - bh - 6, bh);
            return (
              <g key={`n-${a.id}`}>
                <circle cx={x} cy={y} r={7} fill="rgba(91,155,255,0.18)" />
                <circle cx={x} cy={y} r={3.2} fill="#8fb8ff" stroke="#fff" strokeWidth={0.8} />
                <g transform={`translate(${bx} ${by})`}>
                  <rect width={bw} height={bh} rx={7} fill="rgba(5,11,20,0.9)" stroke="rgba(91,155,255,0.35)" />
                  <text x={9} y={14} fontSize={11.5} fontWeight={700} fill="#e6edf7">{a.label}</text>
                  <text x={9} y={27} fontSize={10.5} fill="#8a98ae" className="num">{a.rtt} ms</text>
                </g>
              </g>
            );
          })}

          {/* Singapore: Cloudflare edge (SIN) with the AWS origin in ap-southeast-1 right beside it */}
          <circle cx={sg[0]} cy={sg[1]} r={34} fill="url(#sg-glow)" />
          <circle cx={sg[0]} cy={sg[1]} r={9} fill="none" stroke="#34d399" strokeWidth={1.4} className="animate-pulse-ring" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          <circle cx={sg[0]} cy={sg[1]} r={11} fill="none" stroke="rgba(52,211,153,0.55)" strokeWidth={1} />
          <circle cx={sg[0]} cy={sg[1]} r={5.2} fill="#fff" stroke="#f6821f" strokeWidth={2.6} />
          <g transform={`translate(${clampX(sg[0] + 16, 92)} ${clampY(sg[1] - 30, 38)})`}>
            <rect width={92} height={38} rx={7} fill="rgba(5,11,20,0.92)" stroke="rgba(52,211,153,0.5)" />
            <circle cx={11} cy={13} r={3} fill="#22c55e" />
            <text x={19} y={17} fontSize={11.5} fontWeight={700} fill="#e6edf7">SG</text>
            <text x={40} y={17} fontSize={10.5} fill="#86efac" className="num">{sgRtt != null ? `${Math.round(sgRtt)} ms` : "12 ms"}</text>
            <text x={9} y={30} fontSize={9.5} fill="#8a98ae">Cloudflare · SIN</text>
          </g>

          <path d={`M${sg[0]} ${sg[1] + 7}L${sg[0]} ${sg[1] + 40}`} stroke="#ff9900" strokeWidth={1.3} className="flow-dash" />
          <g transform={`translate(${clampX(sg[0] - 72, 144)} ${clampY(sg[1] + 40, 44)})`}>
            <rect width={144} height={44} rx={8} fill="rgba(5,11,20,0.94)" stroke="#ff9900" strokeOpacity={0.75} />
            <text x={10} y={17} fontSize={11.5} fontWeight={700} fill="#ffb347">AWS EC2 <tspan fontWeight={400} fontSize={10} fill="#8a98ae">origin</tspan></text>
            <text x={10} y={31} fontSize={10} fill="#8a98ae">ap-southeast-1</text>
            <circle cx={98} cy={28} r={2.8} fill={originHealthy === false ? "#f59e0b" : "#22c55e"} />
            <text x={104} y={31} fontSize={10} fill={originHealthy === false ? "#fcd34d" : "#86efac"}>{originHealthy === false ? "Check" : "Healthy"}</text>
          </g>
        </svg>
      )}
    </div>
  );
}
