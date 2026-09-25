import { Gauge, Play, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { simulateBurst } from "../data/demo";
import { timed } from "../lib/api";
import { navigate } from "../lib/router";
import { useStore, verdictOf } from "../lib/store";
import { LiveTag, SimTag, StatusCode } from "./ui";

const SIZES = [100, 500, 1000, 5000, 10000];
const TICKS = 14;

function buildBurst(total: number) {
  const { allowed, blocked, ips } = simulateBurst(total);
  // A spike that ramps up fast and decays; the edge admits at most `allowed` overall.
  const shape = Array.from({ length: TICKS }, (_, i) => (i < 2 ? 0.02 : Math.exp(-((i - 5.5) ** 2) / 7)));
  const sum = shape.reduce((a, b) => a + b, 0);
  let admittedLeft = allowed;
  let assigned = 0;
  const rows = shape.map((s, i) => {
    const incoming = i === TICKS - 1 ? total - assigned : Math.round((s / sum) * total);
    assigned += incoming;
    const pass = Math.min(incoming, Math.max(0, Math.round(admittedLeft * (i < 7 ? 0.55 : 1))));
    admittedLeft -= pass;
    return { t: `${i}s`, incoming, allowed: pass, blocked: incoming - pass };
  });
  const admitted = rows.reduce((a, r) => a + r.allowed, 0);
  return { ips, allowed: admitted, blocked: total - admitted, modelAllowed: allowed, modelBlocked: blocked, rows };
}

function Simulation() {
  const [size, setSize] = useState(300 as number);
  const [run, setRun] = useState<ReturnType<typeof buildBurst> | null>(null);
  const [shown, setShown] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const start = () => {
    const b = buildBurst(size);
    setRun(b); setShown(1);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => setShown((n) => { if (n >= TICKS) { window.clearInterval(timer.current); return n; } return n + 1; }), 170);
  };
  useEffect(() => () => window.clearInterval(timer.current), []);

  const done = run && shown >= TICKS;
  const data = run ? run.rows.slice(0, shown) : [];
  return (
    <div className="panel flex min-w-0 flex-col gap-2.5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold">Simulate traffic burst to <span className="font-mono">/headers</span></div>
        <SimTag>Simulation</SimTag>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Burst size"
          className="h-9 rounded-lg border border-line-strong bg-ink-850 px-2.5 text-[13px] text-fg focus:outline-none">
          {[300, ...SIZES].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n.toLocaleString()} requests</option>)}
        </select>
        <button className="btn-primary" onClick={start}><Play className="size-3.5" fill="currentColor" />Send Requests</button>
        {run && !done && <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-warn"><TriangleAlert className="size-3.5" />TRAFFIC SPIKE DETECTED</span>}
      </div>
      <div className="h-[132px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.length ? data : [{ t: "0s", incoming: 0, allowed: 0, blocked: 0 }]} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#152236" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: "#5a6780", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#5a6780", fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={{ background: "#0a1421", border: "1px solid #1f3150", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#8a98ae" }} />
            <Area type="monotone" dataKey="incoming" name="Incoming req/s" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} strokeWidth={1.6} isAnimationActive={false} />
            <Area type="monotone" dataKey="blocked" name="Blocked at edge" stroke="#ef4444" fill="#ef4444" fillOpacity={0.18} strokeWidth={1.4} isAnimationActive={false} />
            <Area type="monotone" dataKey="allowed" name="Reached origin" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={1.6} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5 text-muted"><i className="size-2 rounded-sm bg-warn" />Incoming</span>
        <span className="flex items-center gap-1.5 text-muted"><i className="size-2 rounded-sm bg-bad" />Blocked</span>
        <span className="flex items-center gap-1.5 text-muted"><i className="size-2 rounded-sm bg-ok" />Allowed</span>
        <span className="ml-auto text-[11.5px] text-muted">Requests / sec</span>
      </div>
      <div className="min-h-[38px] rounded-lg border border-line bg-ink-850 px-3 py-2 text-[12.5px]">
        {done && run ? (
          <><span className="font-semibold text-[#f87171] num">{run.blocked.toLocaleString()} / {size.toLocaleString()}</span> requests blocked at edge · only <span className="font-semibold text-[#4ade80] num">{run.allowed.toLocaleString()}</span> reached origin
            <span className="block text-[11px] text-dim">Model: {run.ips} source IPs × 5 requests allowed per 10 s window (the real rule).</span></>
        ) : <span className="text-dim">Pick a burst size and send it — the chart shows what the edge absorbs.</span>}
      </div>
    </div>
  );
}

function LiveTest() {
  const { record, edge } = useStore();
  const [results, setResults] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [cool, setCool] = useState(0);
  const N = 12;

  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);

  const go = async () => {
    setBusy(true); setResults([]);
    const out: number[] = [];
    for (let i = 1; i <= N; i++) {
      const path = `/headers?live=${i}`;
      try {
        const r = await timed<unknown>(`${path}&ts=${Date.now()}`);
        out.push(r.status);
        record({ t: new Date().toISOString(), method: "GET", path, status: r.status, ray: r.ray, colo: r.ray?.split("-").pop() ?? null, country: edge?.loc ?? null, ms: r.ms, verdict: verdictOf(r.status) });
      } catch { out.push(0); }
      setResults([...out]);
    }
    setBusy(false);
    if (out.includes(429)) setCool(60);
  };

  const ok = results.filter((s) => s === 200).length;
  const limited = results.filter((s) => s === 429).length;
  return (
    <div className="panel flex min-w-0 flex-col gap-2.5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold">Verify against the production rule</div>
        <LiveTag />
      </div>
      <div className="rounded-lg border border-edge/25 bg-edge/[0.06] px-3 py-2 font-mono text-[11.5px] text-[#fdba74]">
        app.strikemap.space/headers · 5 req / 10 s per IP → block 60 s (429)
      </div>
      <button className="btn-ghost self-start" onClick={go} disabled={busy}><Gauge className="size-4 text-edge" />{busy ? `Sending… ${results.length}/${N}` : `Send ${N} real requests`}</button>
      <div className="grid grid-cols-12 items-end gap-1" style={{ height: 70 }} aria-label="Result of each live request">
        {Array.from({ length: N }, (_, i) => {
          const s = results[i];
          const h = 22 + (i / (N - 1)) * 78;
          const c = s === undefined ? "bg-line-strong/60" : s === 200 ? "bg-gradient-to-t from-emerald-700 to-emerald-400" : s === 429 ? "bg-gradient-to-t from-red-700 to-orange-400" : "bg-slate-600";
          return <div key={i} className={`rounded-t-[3px] ${c}`} style={{ height: `${h}%` }} title={s ? `Request ${i + 1}: ${s}` : `Request ${i + 1}`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-1">{results.map((s, i) => <StatusCode key={i} code={s} />)}</div>
      <div className="min-h-[38px] rounded-lg border border-line bg-ink-850 px-3 py-2 text-[12.5px]">
        {results.length === N ? (
          <><span className="font-semibold text-[#4ade80]">{ok}</span> reached the origin · <span className="font-semibold text-[#f87171]">{limited}</span> blocked by Cloudflare (429)
            {cool > 0 && <span className="text-dim"> · your IP is blocked on /headers for ~{cool}s</span>}
            <button className="ml-2 font-semibold text-accent-soft hover:underline" onClick={() => navigate("/logs")}>Check origin log →</button></>
        ) : <span className="text-dim">Real requests from this browser. Blocked ones never reach AWS — the origin log proves it.</span>}
      </div>
    </div>
  );
}

export function RateLimitView({ full = false }: { full?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {full && (
        <p className="text-[13px] text-muted">Protect the AWS origin from abusive traffic <span className="text-fg">before</span> requests reach the infrastructure.</p>
      )}
      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <Simulation />
        <LiveTest />
      </div>
    </div>
  );
}
