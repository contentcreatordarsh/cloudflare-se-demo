import { useEffect, useRef, useState } from "react";
import MAP from "../data/flat-map.json";
import { TRAFFIC_MIX } from "../data/demo";
import { SimTag } from "./ui";

type Ping = { id: number; x: number; y: number; color: string; toSin: boolean };
const ALL = MAP.cities as unknown as Record<string, [number, number]>;
const CITIES = Object.entries(ALL).filter(([k]) => k !== "SIN");
const SIN = ALL.SIN;

function pickCategory(r: number) {
  let acc = 0;
  for (const c of TRAFFIC_MIX) { acc += c.pct / 100; if (r <= acc) return c; }
  return TRAFFIC_MIX[0];
}

export function TrafficMap() {
  const [pings, setPings] = useState<Ping[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const iv = setInterval(() => {
      if (document.hidden) return;
      const n = 1 + Math.floor(Math.random() * 2);
      const fresh: Ping[] = Array.from({ length: n }, () => {
        const [, [x, y]] = CITIES[Math.floor(Math.random() * CITIES.length)];
        const c = pickCategory(Math.random());
        return { id: ++seq.current, x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 4, color: c.color, toSin: c.key === "allowed" && Math.random() < 0.35 };
      });
      setPings((p) => [...p.slice(-26), ...fresh]);
    }, 520);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="panel flex min-w-0 flex-col px-3 pt-2 pb-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">Live Traffic Map</span>
        <SimTag />
      </div>
      <div className="mt-1 flex min-h-0 flex-1 items-center gap-3">
        <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} className="h-auto min-w-0 flex-1" role="img" aria-label="Illustrative map of traffic by outcome">
          <path d={MAP.path} stroke="#223453" strokeWidth={2.1} strokeLinecap="round" fill="none" />
          <circle cx={SIN[0]} cy={SIN[1]} r={3.4} fill="#f6821f" />
          <circle cx={SIN[0]} cy={SIN[1]} r={7} fill="none" stroke="#f6821f" strokeOpacity={0.5} className="animate-pulse-ring" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          {pings.map((p) => (
            <g key={p.id}>
              {p.toSin && <line x1={p.x} y1={p.y} x2={SIN[0]} y2={SIN[1]} stroke={p.color} strokeOpacity={0.28} strokeWidth={0.8} className="animate-fade-in" />}
              <circle cx={p.x} cy={p.y} r={2.2} fill={p.color} opacity={0.95} />
              <circle cx={p.x} cy={p.y} r={4} fill="none" stroke={p.color} strokeWidth={1} className="animate-pulse-ring" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
            </g>
          ))}
        </svg>
        <ul className="w-[108px] shrink-0 space-y-[3px]">
          {TRAFFIC_MIX.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-[11px]">
              <span className="size-2.5 rounded-[3px]" style={{ background: c.color }} />
              <span className="flex-1 text-muted">{c.label}</span>
              <span className="font-mono text-fg num">{c.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
