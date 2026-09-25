import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { KPIS, type Kpi } from "../data/demo";
import { useStore } from "../lib/store";
import { Dot, SimTag } from "./ui";

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function KpiCard({ k }: { k: Kpi }) {
  const v = useCountUp(k.value);
  const up = k.delta > 0;
  return (
    <div className="panel flex min-w-0 flex-col px-3 pt-2 pb-1">
      <div className="truncate text-[11.5px] text-muted" title={k.label}>{k.label}</div>
      <div className="mt-1 text-[21px] leading-none font-semibold tracking-tight num">
        {v.toLocaleString("en-US")}{k.unit && <span className="ml-1 text-[14px] font-medium text-muted">{k.unit}</span>}
      </div>
      <div className="mt-1 flex items-center gap-0.5 text-[11.5px] font-semibold num" style={{ color: k.color }}>
        {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{Math.abs(k.delta)}%
      </div>
      <div className="-mx-1 mt-auto h-[24px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={k.data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`kg-${k.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={k.color} stopOpacity={0.35} />
                <stop offset="1" stopColor={k.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={k.color} strokeWidth={1.5} fill={`url(#kg-${k.id})`} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function OriginHealthCard() {
  const { status, statusError } = useStore();
  const [history, setHistory] = useState<boolean[]>([]);
  const lastAt = useRef<string | null>(null);
  useEffect(() => {
    if (!status || status.serverTime === lastAt.current) return;
    lastAt.current = status.serverTime;
    setHistory((h) => [...h, status.health.healthy].slice(-12));
  }, [status]);
  useEffect(() => { if (statusError) setHistory((h) => [...h, false].slice(-12)); }, [statusError]);

  const checks = status?.health.checks ?? [];
  const pct = checks.length ? Math.round((checks.filter((c) => c.ok).length / checks.length) * 100) : null;
  const healthy = !!status?.health.healthy && !statusError;
  const blocks = Array.from({ length: 12 }, (_, i) => history[history.length - 12 + i]);
  return (
    <div className="panel flex min-w-0 flex-col px-3 pt-2 pb-2" title={checks.map((c) => `${c.ok ? "✓" : "!"} ${c.name}: ${c.detail}`).join("\n")}>
      <div className="flex items-center justify-between gap-1.5"><span className="truncate text-[11.5px] text-muted">Origin Health</span><span className="flex items-center" title="Live — measured from the origin"><Dot pulse /></span></div>
      <div className="mt-1 text-[21px] leading-none font-semibold tracking-tight num">{pct == null ? "—" : `${pct}%`}</div>
      <div className={`mt-1 text-[11.5px] font-semibold ${healthy ? "text-ok" : status ? "text-warn" : "text-muted"}`}>{status ? (healthy ? "Healthy" : "Degraded") : "Checking…"}</div>
      <div className="mt-auto flex gap-[3px] pt-2" aria-label="Last 12 health checks, every 20 seconds">
        {blocks.map((b, i) => (
          <span key={i} className={`h-3 flex-1 rounded-[2px] ${b === undefined ? "bg-line-strong/60" : b ? "bg-ok" : "bg-warn"}`} />
        ))}
      </div>
    </div>
  );
}

export function KpiRow() {
  return (
    <section>
      <div className="mb-1 flex items-center gap-2"><span className="label">Edge telemetry · last 24 h</span><SimTag /></div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => <KpiCard key={k.id} k={k} />)}
        <OriginHealthCard />
      </div>
    </section>
  );
}
