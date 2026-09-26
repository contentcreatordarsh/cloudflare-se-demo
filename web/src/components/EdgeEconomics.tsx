import { ArrowRight, CircleDollarSign, Globe2, Layers, Scale, Server, TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "../lib/store";

// Illustrative traffic model only. Deliberately no pricing: the split of traffic is what changes the
// AWS data-transfer conversation, and real costs need the customer's own traffic profile and AWS pricing.

export const TRAFFIC_OPTIONS = [10, 25, 50, 100];

export function fmtTB(tb: number) {
  if (tb >= 1) return `${Number.isInteger(tb) ? tb : tb.toFixed(1)} TB`;
  return `${Math.round(tb * 1000)} GB`;
}

export function useEconModel() {
  const { econ } = useStore();
  const total = econ.tb * (econ.period === "annual" ? 12 : 1);
  const edge = total * (econ.pct / 100);
  return { total, edge, origin: total - edge, pct: econ.pct, periodLabel: econ.period === "annual" ? "Annual" : "Monthly" };
}

function Flow({ large = false }: { large?: boolean }) {
  const { econ, setEcon } = useStore();
  const m = useEconModel();
  const box = large ? "px-3.5 py-2.5" : "px-2.5 py-1.5";
  return (
    <div className="flex flex-col items-stretch">
      <div className="flex items-center justify-center gap-2">
        <span className="grid size-7 place-items-center rounded-full border border-accent/40 bg-accent/10 text-accent-soft"><Globe2 className="size-3.5" /></span>
        <span className="leading-tight">
          <span className="block text-[10px] tracking-[0.12em] text-muted uppercase">{m.periodLabel} internet traffic</span>
          <span className="flex items-center gap-1">
            <select value={econ.tb} onChange={(e) => setEcon({ tb: Number(e.target.value) })} aria-label="Monthly internet traffic"
              className={`-ml-1 cursor-pointer rounded bg-transparent px-1 font-semibold text-fg num hover:bg-white/5 focus:outline-none ${large ? "text-[24px]" : "text-[16px]"}`}>
              {TRAFFIC_OPTIONS.map((t) => <option key={t} value={t} className="bg-ink-800 text-[13px]">{fmtTB(t * (econ.period === "annual" ? 12 : 1))}</option>)}
            </select>
          </span>
        </span>
      </div>
      <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="w-full" style={{ height: large ? 40 : 22 }} aria-hidden>
        <defs>
          <marker id={`ah-e${large ? "L" : ""}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#00c2ff" /></marker>
          <marker id={`ah-o${large ? "L" : ""}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#f6821f" /></marker>
        </defs>
        <path d="M200 1 C200 24, 110 16, 90 37" fill="none" stroke="#00c2ff" strokeWidth={1.4 + (m.pct / 100) * 3} strokeLinecap="round" markerEnd={`url(#ah-e${large ? "L" : ""})`} vectorEffect="non-scaling-stroke" />
        <path d="M200 1 C200 24, 290 16, 310 37" fill="none" stroke="#f6821f" strokeWidth={1.4 + ((100 - m.pct) / 100) * 3} strokeLinecap="round" markerEnd={`url(#ah-o${large ? "L" : ""})`} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-md border border-cyan/25 bg-cyan/[0.06] ${box}`}>
          <div className="flex items-baseline justify-between gap-1">
            <span className={`font-semibold text-cyan num ${large ? "text-[22px]" : "text-[15px]"}`}>{m.pct}%</span>
            <span className={`font-semibold num ${large ? "text-[17px]" : "text-[13px]"}`}>{fmtTB(m.edge)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium"><Layers className="size-3.5 text-cyan" />Edge-handled</div>
          <div className="truncate text-[10.5px] text-dim" title="Cached, blocked, challenged, static assets and edge-logic responses are answered by Cloudflare">Cached · blocked · challenged · edge logic</div>
        </div>
        <div className={`rounded-md border border-brand/30 bg-brand/[0.06] ${box}`}>
          <div className="flex items-baseline justify-between gap-1">
            <span className={`font-semibold text-brand num ${large ? "text-[22px]" : "text-[15px]"}`}>{100 - m.pct}%</span>
            <span className={`font-semibold num ${large ? "text-[17px]" : "text-[13px]"}`}>{fmtTB(m.origin)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium"><Server className="size-3.5 text-brand" />Origin-bound</div>
          <div className="flex items-center gap-1 truncate text-[10.5px] text-[#ffb070]" title="Traffic that reaches the AWS origin in ap-southeast-1 may incur AWS data transfer / egress charges">
            <TriangleAlert className="size-3 shrink-0" />May incur AWS egress charges
          </div>
        </div>
      </div>
    </div>
  );
}

function Controls({ full = false }: { full?: boolean }) {
  const { econ, setEcon } = useStore();
  const m = useEconModel();
  return (
    <div className="space-y-1.5 text-[12px]">
      <label className="flex items-center gap-3">
        <span className="shrink-0 text-muted">Edge-handled</span>
        <input type="range" min={0} max={100} step={1} value={econ.pct} onChange={(e) => setEcon({ pct: Number(e.target.value) })}
          aria-label="Edge-handled traffic percentage" className="h-1 flex-1 cursor-pointer accent-[var(--color-brand)]" />
        <span className="w-[42px] text-right font-mono text-fg num">{econ.pct}%</span>
      </label>
      {full && (
        <>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Total traffic</span><span className="font-mono num">{fmtTB(m.total)}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Edge-handled</span><span className="font-mono text-cyan num">{econ.pct}% ({fmtTB(m.edge)})</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Origin-bound (reaches AWS)</span><span className="font-mono text-brand num">{100 - econ.pct}% ({fmtTB(m.origin)})</span></div>
          <div className="text-[11px] text-dim">Validate with the actual traffic profile.</div>
        </>
      )}
    </div>
  );
}

const DISCLAIMER =
  "AWS transfer economics must be validated against the actual architecture, traffic profile and AWS pricing. CloudFront has AWS-native transfer economics that differ from an independent Cloudflare-to-EC2 architecture. This model is illustrative.";

const Disclaimer = ({ compact = false }: { compact?: boolean }) => (
  <div className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/[0.07] px-2.5 py-1 text-[10.5px] leading-snug text-[#f5d38a]" title={DISCLAIMER}>
    <TriangleAlert className="mt-px size-3.5 shrink-0" />
    <span className={compact ? "truncate" : ""}>{compact ? "Validate AWS transfer economics against the real architecture, traffic and pricing. Illustrative." : DISCLAIMER}</span>
  </div>
);

/** Compact panel shown next to the Request Journey on the Overview. */
export function EdgeEconomicsPanel() {
  const { econ, setEcon, setCompareOpen } = useStore();
  return (
    <div className="panel flex min-w-0 flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-brand/50 bg-brand/10 text-brand"><CircleDollarSign className="size-4" /></span>
          <div>
            <div className="flex items-center gap-2 text-[14px] font-semibold">Edge Economics <span className="rounded bg-brand px-1.5 py-px text-[9.5px] font-bold text-white uppercase">New</span></div>
            <div className="truncate text-[11px] text-muted">Traffic flow &amp; potential AWS transfer costs</div>
          </div>
        </div>
        <select value={econ.period} onChange={(e) => setEcon({ period: e.target.value as "monthly" | "annual" })} aria-label="Period"
          className="h-7 rounded border border-line-strong bg-ink-850 px-1.5 text-[11.5px] text-fg focus:outline-none">
          <option value="monthly">Monthly</option><option value="annual">Annual</option>
        </select>
      </div>
      <Flow />
      <Controls />
      <button onClick={() => setCompareOpen(true)} className="flex items-center gap-2.5 rounded-md border border-line-strong bg-ink-850 px-2.5 py-1 text-left transition hover:border-brand/50">
        <Scale className="size-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 leading-tight"><span className="block text-[12px] font-semibold">Compare Architecture</span><span className="block truncate text-[11px] text-dim">AWS-native (CloudFront) vs Cloudflare + AWS</span></span>
        <ArrowRight className="size-4 text-brand" />
      </button>
      <Disclaimer compact />
    </div>
  );
}

const PRESETS = [
  { label: "Mostly dynamic API", pct: 5 },
  { label: "Typical trading platform", pct: 42 },
  { label: "Cache-heavy content", pct: 75 },
];

/** Full-page version with presets and the decision framework. */
export function EdgeEconomicsFull() {
  const { econ, setEcon, setCompareOpen } = useStore();
  const m = useEconModel();
  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[15px] font-semibold">Illustrative traffic model</div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted">Period</span>
          <select value={econ.period} onChange={(e) => setEcon({ period: e.target.value as "monthly" | "annual" })} aria-label="Period"
            className="h-8 rounded border border-line-strong bg-ink-850 px-2 text-[12px] text-fg focus:outline-none">
            <option value="monthly">Monthly</option><option value="annual">Annual</option>
          </select>
        </div>
      </div>
      <Flow large />
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <Controls full />
        <div>
          <div className="label mb-1.5">Scenario presets</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.pct} onClick={() => setEcon({ pct: p.pct })} className={`chip ${econ.pct === p.pct ? "border-brand/60 bg-brand/10 text-white" : ""}`}>{p.label} · {p.pct}%</button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">
            At {m.pct}% edge-handled, <span className="font-mono text-fg">{fmtTB(m.origin)}</span> of {fmtTB(m.total)} is origin-bound — it still reaches AWS each {econ.period === "annual" ? "year" : "month"}.
            {m.pct <= 10 && " For a mostly dynamic workload, model the AWS data transfer economics explicitly — don't assume savings."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Disclaimer />
        <button className="btn-primary" onClick={() => setCompareOpen(true)}><Scale className="size-4" />Compare Architecture</button>
      </div>
    </div>
  );
}

const ROWS: [string, string, string][] = [
  ["CDN", "CloudFront", "Cloudflare"],
  ["WAF", "AWS WAF", "Cloudflare WAF"],
  ["DDoS", "AWS Shield", "Cloudflare DDoS protection"],
  ["Rate limiting", "AWS controls (WAF rate-based rules)", "Cloudflare Rate Limiting"],
  ["Bot management", "AWS ecosystem", "Cloudflare Bot Management"],
  ["Edge compute", "Lambda@Edge / CloudFront Functions", "Workers"],
  ["Private access", "AWS ecosystem", "Cloudflare Access"],
  ["Private connectivity", "AWS options", "Cloudflare Tunnel"],
  ["Origin", "EC2", "EC2"],
  ["AWS transfer economics", "AWS-native", "Must be modelled"],
  ["Multi-cloud flexibility", "AWS-centric", "Origin-independent"],
];

export function CompareModal() {
  const { compareOpen, setCompareOpen } = useStore();
  useEffect(() => {
    if (!compareOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setCompareOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [compareOpen, setCompareOpen]);
  if (!compareOpen) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Compare architecture" onClick={() => setCompareOpen(false)}>
      <div className="panel-hi w-full max-w-[760px] overflow-hidden shadow-2xl shadow-black/70 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-[15px] font-semibold"><Scale className="size-4 text-brand" />AWS-native vs Cloudflare + AWS</div>
          <button className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-fg" onClick={() => setCompareOpen(false)} aria-label="Close"><X className="size-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] tracking-[0.1em] text-dim uppercase">
                <th className="py-1.5 pr-3 font-semibold">Capability</th><th className="py-1.5 pr-3 font-semibold">AWS-native</th><th className="py-1.5 font-semibold text-brand">Cloudflare + AWS</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([cap, aws, cf]) => (
                <tr key={cap} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{cap}</td><td className="py-2 pr-3 text-muted">{aws}</td><td className="py-2 text-fg">{cf}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 rounded-md border border-line-strong bg-ink-850 p-3">
            <p className="text-[13px] font-medium">No winner here. Both are valid architectures; the decision depends on traffic profile, security requirements, operational model and total cost.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Traffic profile", "Security requirements", "Performance", "Operational complexity", "Data transfer economics", "Total cost"].map((t) => (
                <span key={t} className="rounded border border-line-strong px-2 py-0.5 text-[11.5px] text-muted">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
