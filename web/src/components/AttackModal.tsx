import { CircleCheck, Cpu, Server, ShieldCheck, TriangleAlert, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ATTACK } from "../data/demo";
import { navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { SimTag } from "./ui";

// Staged, illustrative attack (spec §25). Clearly labelled as a simulation; the live proof is one click away.
export function AttackModal() {
  const { attackOpen, setAttackOpen, setTab } = useStore();
  const [stage, setStage] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!attackOpen) return;
    setStage(0); setTick(0);
    const timers = [setTimeout(() => setStage(1), 1300), setTimeout(() => setStage(2), 2300), setTimeout(() => setStage(3), 3200), setTimeout(() => setStage(4), 4100), setTimeout(() => setStage(5), 5000)];
    const iv = setInterval(() => setTick((t) => Math.min(t + 1, 30)), 150);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAttackOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { timers.forEach(clearTimeout); clearInterval(iv); window.removeEventListener("keydown", esc); };
  }, [attackOpen, setAttackOpen]);

  const data = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const incoming = i < 4 ? 180 + i * 40 : Math.round(ATTACK.peakRps * Math.min(1, (i - 3) / 5) * (0.9 + 0.1 * Math.sin(i)));
    return { i, incoming, forwarded: Math.min(incoming, 40 + (i % 5) * 3) };
  }), []);

  if (!attackOpen) return null;
  const checks = [
    { icon: ShieldCheck, name: "Cloudflare WAF", result: "Traffic inspected" },
    { icon: Zap, name: "Rate Limiting", result: "Attack blocked" },
    { icon: Server, name: "AWS Origin", result: "Protected" },
  ];
  const pct = ((ATTACK.blocked / ATTACK.total) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Attack simulation" onClick={() => setAttackOpen(false)}>
      <div className="panel-hi w-full max-w-[760px] overflow-hidden shadow-2xl shadow-black/70 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold"><Zap className="size-4 text-warn" fill="currentColor" />Attack simulation <SimTag>Illustrative numbers</SimTag></div>
          <button className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-fg" onClick={() => setAttackOpen(false)} aria-label="Close"><X className="size-4" /></button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[1.25fr_1fr]">
          <div>
            <div className="flex items-center gap-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-[12.5px] font-bold tracking-wide text-[#ff8a93]">
              <TriangleAlert className="size-4" />TRAFFIC ANOMALY DETECTED
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
              <div><div className="text-muted">Peak</div><div className="text-[18px] font-semibold num">{ATTACK.peakRps.toLocaleString()} <span className="text-[12px] text-muted">req/s</span></div></div>
              <div><div className="text-muted">Sources</div><div className="text-[14px] font-semibold">Multiple</div></div>
              <div><div className="text-muted">Target</div><div className="font-mono text-[13px] font-semibold">/headers</div></div>
            </div>
            <div className="mt-3 h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.slice(0, Math.max(2, tick))} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                  <XAxis dataKey="i" hide />
                  <YAxis tick={{ fill: "#62686f", fontSize: 10 }} axisLine={false} tickLine={false} width={48} domain={[0, 14000]} />
                  <Area type="monotone" dataKey="incoming" stroke="#f6821f" fill="#f6821f" fillOpacity={0.15} strokeWidth={1.8} isAnimationActive={false} name="Incoming" />
                  <Area type="monotone" dataKey="forwarded" stroke="#00d084" fill="#00d084" fillOpacity={0.25} strokeWidth={1.8} isAnimationActive={false} name="Forwarded to origin" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[11.5px] text-muted"><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-warn" />Incoming req/s</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-ok" />Forwarded to AWS</span></div>
          </div>

          <div className="flex flex-col gap-2">
            {checks.map((c, i) => (
              <div key={c.name} className={`flex items-center gap-3 rounded-lg border border-line bg-ink-850 px-3 py-2 transition-opacity duration-300 ${stage > i ? "opacity-100" : "opacity-25"}`}>
                <c.icon className="size-4 text-accent-soft" />
                <span className="flex-1 text-[12.5px] font-medium">{c.name}</span>
                <span className="flex items-center gap-1 text-[12px] text-[#5ff0b0]">{stage > i && <CircleCheck className="size-3.5" />}{c.result}</span>
              </div>
            ))}
            <div className={`flex items-center gap-3 rounded-lg border border-line bg-ink-850 px-3 py-2 transition-opacity duration-300 ${stage > 3 ? "opacity-100" : "opacity-25"}`}>
              <Cpu className="size-4 text-accent-soft" /><span className="flex-1 text-[12.5px] font-medium">Origin CPU</span>
              <span className="font-mono text-[12.5px] text-[#5ff0b0] num">{ATTACK.originCpu}%</span>
            </div>
            <div className={`mt-1 rounded-lg border border-ok/30 bg-ok/[0.07] p-3 text-center transition-all duration-500 ${stage > 4 ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
              <div className="text-[34px] leading-none font-bold text-ok num">{pct}%</div>
              <div className="mt-1 text-[12px] font-semibold tracking-wide text-[#5ff0b0] uppercase">Stopped at the edge</div>
              <div className="mt-2 grid grid-cols-3 text-[11.5px]">
                <span><b className="block text-[14px] num">{ATTACK.total.toLocaleString()}</b><span className="text-muted">requests</span></span>
                <span><b className="block text-[14px] text-bad num">{ATTACK.blocked.toLocaleString()}</b><span className="text-muted">blocked</span></span>
                <span><b className="block text-[14px] text-ok num">{ATTACK.forwarded.toLocaleString()}</b><span className="text-muted">forwarded</span></span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <p className="text-[11.5px] text-dim">Numbers are illustrative. The rule and the blocking below are real — prove it live.</p>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setAttackOpen(false)}>Close</button>
            <button className="btn-primary" onClick={() => { setAttackOpen(false); setTab("ratelimit"); navigate("/", { hash: "workspace" }); }}>Run live test against the real rule</button>
          </div>
        </div>
      </div>
    </div>
  );
}
