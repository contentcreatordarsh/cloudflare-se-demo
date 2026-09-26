import { Check, CircleCheck, Copy, ExternalLink, Play, RefreshCw, ShieldCheck, Workflow } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PORTAL_URL } from "../lib/api";
import { navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { Dot, LiveTag, SimTag } from "./ui";

export const NOVA_URL = "https://nova.strikemap.space";

const Tag = ({ kind }: { kind: "active" | "demo" | "rec" | "sim" }) =>
  kind === "active" ? <span className="rounded border border-ok/35 bg-ok/10 px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-wider text-[#5ff0b0] uppercase">Active</span>
  : kind === "demo" ? <span className="sim-tag">Demo</span>
  : kind === "sim" ? <span className="sim-tag">Simulated</span>
  : <span className="rounded border border-brand/35 bg-brand/10 px-1.5 py-px font-mono text-[9px] font-semibold tracking-wider whitespace-nowrap text-brand-soft uppercase">Recommended for production</span>;

function Panel({ id, title, right, children }: { id?: string; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="panel flex min-w-0 scroll-mt-20 flex-col p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="label">{title}</h3>{right}</div>
      {children}
    </section>
  );
}

export function SecurityPanel() {
  const rows: { k: string; v: string; d: string; kind: "active" | "demo"; go?: () => void }[] = [
    { k: "DDoS", v: "Protected", d: "Always-on L3–L7 mitigation", kind: "active" },
    { k: "WAF", v: "Active", d: "Custom rule + Cloudflare Managed Ruleset", kind: "active", go: () => navigate("/security") },
    { k: "Rate limiting", v: "Active", d: "/api/orders · /headers — 5 req / 10 s per IP", kind: "active", go: () => navigate("/rate-limiting") },
    { k: "Bot protection", v: "Demo", d: "Bot Management not configured on this plan", kind: "demo" },
    { k: "TLS", v: "Full (strict)", d: "Let's Encrypt origin certs, validated", kind: "active", go: () => navigate("/tls") },
  ];
  return (
    <Panel title="Security" right={<LiveTag>Config</LiveTag>}>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.k}>
            <button onClick={r.go} disabled={!r.go} className="flex w-full items-center gap-2.5 py-2 text-left enabled:hover:bg-white/[0.02] disabled:cursor-default">
              {r.kind === "active" ? <ShieldCheck className="size-4 shrink-0 text-ok" /> : <ShieldCheck className="size-4 shrink-0 text-dim" />}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-[12.5px] font-semibold">{r.k} <span className={`ml-1 font-mono text-[10.5px] tracking-wider uppercase ${r.kind === "active" ? "text-ok" : "text-dim"}`}>{r.v}</span></span>
                <span className="block truncate text-[11px] text-dim">{r.d}</span>
              </span>
              <Tag kind={r.kind} />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ResiliencyPanel() {
  const { status, statusError, edge } = useStore();
  const t = status?.tunnel;
  const locs = t?.locations ?? [];
  const [drill, setDrill] = useState<"idle" | "drop" | "serving" | "recovered">("idle");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const runDrill = () => {
    timers.current.forEach(clearTimeout);
    setDrill("drop");
    timers.current = [window.setTimeout(() => setDrill("serving"), 1400), window.setTimeout(() => setDrill("recovered"), 3600)];
  };
  const dropped = locs[0]?.colo;
  const ok = (b: boolean | undefined) => <span className={`flex items-center gap-1.5 font-mono text-[10.5px] tracking-wider uppercase ${b ? "text-ok" : "text-warn"}`}><Dot tone={b ? "ok" : "warn"} pulse={b} />{b ? "Healthy" : "Check"}</span>;
  return (
    <Panel id="resiliency" title="Resiliency" right={<LiveTag />}>
      <div className="space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between gap-2"><span>Cloudflare edge <span className="font-mono text-dim">{edge?.colo ?? ""}</span></span><span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-wider text-ok uppercase"><Dot pulse />Operational</span></div>
        <div className="flex items-center justify-between gap-2"><span>Tunnel connector <span className="text-dim">(EC2)</span></span>{ok(!!t && t.ready > 0)}</div>
        <div className="flex flex-wrap gap-1 pl-3">
          {locs.map((l) => {
            const down = drill === "drop" || drill === "serving" ? l.colo === dropped : false;
            return <span key={l.id} className={`rounded border px-1.5 font-mono text-[10px] transition ${down ? "border-bad/40 bg-bad/10 text-bad line-through" : "border-ok/30 bg-ok/[0.07] text-[#5ff0b0]"}`}>conn {l.id} · {l.colo.toUpperCase()}</span>;
          })}
          {!locs.length && <span className="text-[11px] text-dim">{t ? `${t.ready} connections` : "checking…"}</span>}
        </div>
        <div className="flex items-center justify-between gap-2"><span>Origin <span className="text-dim">AWS EC2 · ap-southeast-1</span></span>{ok(!!status?.health.healthy && !statusError)}</div>
        <div className="flex items-center justify-between gap-2"><span>Break-glass path <span className="text-dim">SSH, admin IP only</span></span><span className="font-mono text-[10.5px] tracking-wider text-muted uppercase">Ready</span></div>
        <div className="flex items-center justify-between gap-2"><span>Second connector <span className="text-dim">(other AZ)</span></span><Tag kind="rec" /></div>
        <div className="flex items-center justify-between gap-2"><span>DNS <span className="text-dim">Cloudflare anycast</span></span><span className="font-mono text-[10.5px] text-muted">multi-provider: rec.</span></div>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button className="btn-ghost h-8 px-2.5 text-[12px]" onClick={runDrill}><Play className="size-3" fill="currentColor" />Run failover test</button>
        <SimTag />
      </div>
      <p className="mt-1.5 min-h-[32px] text-[11px] leading-snug text-muted" aria-live="polite">
        {drill === "idle" && "cloudflared holds several connections to different Cloudflare data centers; losing one should not interrupt traffic."}
        {drill === "drop" && <>Simulating loss of connection to <span className="font-mono text-bad">{dropped?.toUpperCase() ?? "one data center"}</span>…</>}
        {drill === "serving" && <>Traffic continues over the remaining <span className="text-ok">{Math.max(0, locs.length - 1)}</span> connections. No real connection was dropped.</>}
        {drill === "recovered" && <><RefreshCw className="mr-1 inline size-3 text-ok" />cloudflared re-establishes the connection automatically. Blast radius: one connection, not the service.</>}
      </p>
    </Panel>
  );
}

export function ProductionReadinessPanel() {
  const shown = ["Security", "Resiliency", "Identity", "Observability", "API protection", "Data controls"];
  const inUse = ["Workers", "R2", "Access + Tunnel", "WAF + Rate limiting"];
  const recommended = ["Enterprise SLA & support", "Advanced Rate Limiting", "Bot Management", "Logpush", "Data Localization"];
  return (
    <Panel title="Production readiness">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {shown.map((s) => <span key={s} className="flex items-center gap-1.5 text-[12px]"><Check className="size-3.5 text-ok" strokeWidth={3} />{s}</span>)}
      </div>
      <div className="mt-2.5 mb-1 text-[10.5px] font-semibold tracking-[0.14em] text-dim uppercase">In use in this demo</div>
      <div className="flex flex-wrap gap-1">{inUse.map((s) => <span key={s} className="rounded border border-ok/30 bg-ok/[0.07] px-1.5 py-px text-[11px] text-[#5ff0b0]">{s}</span>)}</div>
      <div className="mt-2.5 mb-1 flex items-center justify-between gap-2"><span className="text-[10.5px] font-semibold tracking-[0.14em] text-dim uppercase">Enterprise</span><Tag kind="rec" /></div>
      <div className="flex flex-wrap gap-1">{recommended.map((s) => <span key={s} className="rounded border border-line-strong px-1.5 py-px text-[11px] text-muted">{s}</span>)}</div>
      <p className="mt-2 text-[11px] text-dim">Commercials are contract-based; this demo is not a quote. <button className="font-semibold text-brand hover:underline" onClick={() => navigate("/economics")}>Economics →</button></p>
    </Panel>
  );
}

export function LiveEndpointsPanel() {
  const [copied, setCopied] = useState(false);
  const loop = `for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\\n" ${NOVA_URL}/api/orders; done`;
  const links: [string, string, string][] = [
    ["Public NOVA app", NOVA_URL, "nova.strikemap.space"],
    ["Request inspector", `${NOVA_URL}/headers`, "/headers"],
    ["Health check", `${NOVA_URL}/healthz`, "/healthz"],
    ["Orders API (rate limited)", `${NOVA_URL}/api/orders`, "/api/orders"],
    ["Staff portal (Access → Worker → Tunnel)", PORTAL_URL, "tunnel.strikemap.space/secure"],
  ];
  return (
    <Panel title="Live endpoints" right={<LiveTag />}>
      <ul className="space-y-1">
        {links.map(([name, href, short]) => (
          <li key={href}>
            <a href={href} target="_blank" rel="noopener" className="flex items-center gap-2 rounded px-1 py-1 text-[12px] hover:bg-white/[0.03]">
              <Workflow className="size-3.5 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 leading-tight"><span className="block truncate">{name}</span><span className="block truncate font-mono text-[10.5px] text-dim">{short}</span></span>
              <ExternalLink className="size-3.5 shrink-0 text-dim" />
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2 rounded-md border border-line-strong bg-ink-850 px-2 py-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted" title={loop}>{loop}</code>
        <button className="shrink-0 text-muted hover:text-fg" aria-label="Copy curl loop" onClick={() => navigator.clipboard.writeText(loop).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); })}>
          {copied ? <CircleCheck className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </Panel>
  );
}

export function PostureRow() {
  return (
    <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4" aria-label="Security and resiliency posture">
      <SecurityPanel />
      <ResiliencyPanel />
      <ProductionReadinessPanel />
      <LiveEndpointsPanel />
    </section>
  );
}
