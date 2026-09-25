import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TRAFFIC_MIX } from "../data/demo";
import { SimTag } from "./ui";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Traffic mix for the last 5 minutes (illustrative, gently ticking). */
export function LiveTrafficPanel() {
  const [total, setTotal] = useState(12872);
  useEffect(() => {
    if (reduced()) return;
    const t = setInterval(() => { if (!document.hidden) setTotal((n) => Math.max(11800, Math.min(13900, n + Math.round((Math.random() - 0.45) * 90)))); }, 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="panel flex h-full flex-col px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold">Live Traffic</div>
          <div className="text-[11px] text-dim">Last 5 minutes · <span className="num">{total.toLocaleString()}</span> requests</div>
        </div>
        <SimTag />
      </div>
      <ul className="mt-3 flex flex-1 flex-col justify-around gap-2">
        {TRAFFIC_MIX.map((c) => (
          <li key={c.key} className="grid grid-cols-[auto_1fr_minmax(0,1fr)_34px_48px] items-center gap-2 text-[12px]">
            <span className="size-2.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
            <span className="truncate text-muted">{c.label === "Blocked" ? "Blocked (WAF)" : c.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-line-strong/70">
              <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${c.pct}%`, background: c.color }} />
            </span>
            <span className="text-right font-mono text-fg num">{c.pct}%</span>
            <span className="text-right font-mono text-muted num">{Math.round((total * c.pct) / 100).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const WINDOWS = { "5 min": 30, "15 min": 45, "1 h": 60 } as const;
type Win = keyof typeof WINDOWS;

function point(i: number, base = 2600) {
  const wave = Math.sin(i / 3.1) * 420 + Math.sin(i / 7.3) * 380;
  const total = Math.max(600, Math.round(base + wave + (Math.random() - 0.5) * 520));
  const blocked = Math.round(total * (0.12 + Math.random() * 0.08));
  return { i, total, blocked, origin: Math.round(total * 0.04 + Math.random() * 40) };
}

/** Requests per second (illustrative), scrolling every 2 s. */
export function RpsPanel() {
  const [win, setWin] = useState<Win>("5 min");
  const [data, setData] = useState(() => Array.from({ length: 60 }, (_, i) => point(i)));
  useEffect(() => {
    if (reduced()) return;
    const t = setInterval(() => { if (!document.hidden) setData((d) => [...d.slice(1), point(d[d.length - 1].i + 1)]); }, 2000);
    return () => clearInterval(t);
  }, []);
  const view = useMemo(() => data.slice(-WINDOWS[win]), [data, win]);
  return (
    <div className="panel flex h-full flex-col px-3.5 pt-2.5 pb-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold whitespace-nowrap">Requests / sec</span>
        <div className="flex items-center gap-1.5">
          <SimTag />
          <select value={win} onChange={(e) => setWin(e.target.value as Win)} aria-label="Time window"
            className="h-6 rounded border border-line-strong bg-ink-850 px-1.5 text-[11px] text-fg focus:outline-none">
            {Object.keys(WINDOWS).map((w) => <option key={w}>{w}</option>)}
          </select>
        </div>
      </div>
      <div className="min-h-[64px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={view} margin={{ top: 6, right: 2, bottom: 0, left: -26 }}>
            <CartesianGrid stroke="#1c2025" vertical={false} />
            <XAxis dataKey="i" hide />
            <YAxis tick={{ fill: "#62686f", fontSize: 9.5 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`)} />
            <Tooltip contentStyle={{ background: "#101214", border: "1px solid #2a2f36", borderRadius: 6, fontSize: 11.5 }} labelFormatter={() => ""} />
            <Area type="monotone" dataKey="total" name="Total" stroke="#2f80ed" fill="#2f80ed" fillOpacity={0.22} strokeWidth={1.4} isAnimationActive={false} />
            <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#ff4d5a" fill="#ff4d5a" fillOpacity={0.25} strokeWidth={1.2} isAnimationActive={false} />
            <Area type="monotone" dataKey="origin" name="Origin" stroke="#00d084" fill="#00d084" fillOpacity={0.2} strokeWidth={1.2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 text-[10.5px] text-muted">
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-accent" />Total</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-bad" />Blocked</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-ok" />Origin</span>
      </div>
    </div>
  );
}
