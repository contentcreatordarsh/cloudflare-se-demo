import { Bug, CircleCheck, CircleAlert, CircleDollarSign, FileWarning, Gauge, Play, ShieldCheck, ShieldHalf, Syringe, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { ArchitectureFlow } from "./components/ArchitectureFlow";
import { EdgeEconomicsFull } from "./components/EdgeEconomics";
import { Hero } from "./components/Hero";
import { JourneyPanel, TracePanel } from "./components/Journey";
import { KpiRow } from "./components/KpiRow";
import { LiveTrafficPanel, RpsPanel } from "./components/LiveTraffic";
import { LogsView } from "./components/LogsView";
import { RateLimitView } from "./components/RateLimitView";
import { StaffView } from "./components/StaffView";
import { TlsView } from "./components/TlsView";
import { Workspace } from "./components/Workspace";
import { LiveTag, PageHeader, StatusCode } from "./components/ui";
import { timed, type OriginTrace } from "./lib/api";
import { useStore, verdictOf, XSS_PROBE } from "./lib/store";

function ValueStory() {
  const items = [
    { icon: ShieldCheck, t: "Security", d: "Threats are stopped before they reach AWS." },
    { icon: Zap, t: "Performance", d: "Users connect through the global Cloudflare edge." },
    { icon: Gauge, t: "Reliability", d: "Traffic spikes are absorbed before overwhelming the origin." },
    { icon: ShieldHalf, t: "Zero Trust", d: "Internal apps need no publicly exposed inbound ports." },
    { icon: CircleDollarSign, t: "Economics", d: "Evaluate edge architecture against the actual traffic profile." },
  ];
  return (
    <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-5">
      {items.map(({ icon: Icon, t, d }) => (
        <div key={t} className="flex items-center gap-2.5 rounded-lg border border-line bg-ink-900/60 px-3 py-2">
          <Icon className="size-4 shrink-0 text-brand" />
          <p className="text-[12px] text-muted"><span className="font-semibold text-fg">{t}.</span> {d}</p>
        </div>
      ))}
    </section>
  );
}

export function OverviewPage() {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_296px]">
        <div className="xl:col-start-1 xl:row-start-1"><Hero /></div>
        <div className="xl:col-start-2 xl:row-start-1"><LiveTrafficPanel /></div>
        <div className="xl:col-start-1 xl:row-start-2"><KpiRow /></div>
        <div className="xl:col-start-2 xl:row-start-2 xl:pt-[19px]"><RpsPanel /></div>
      </div>
      <Workspace />
      <ValueStory />
    </div>
  );
}

function classify(name: string, via?: string): [string, string] {
  if (name === "cf-warp-tag-id" || (via === "tunnel" && name.startsWith("cf-access"))) return ["Cloudflare Tunnel", "text-[#c4b5fd]"];
  if (name.startsWith("cf-") || ["cdn-loop", "x-forwarded-for", "true-client-ip"].includes(name)) return ["Cloudflare", "text-edge"];
  if (["x-origin-tls-protocol", "x-origin-tls-cipher", "x-edge-ip", "x-forwarded-proto", "connection"].includes(name)) return ["Nginx (origin)", "text-cyan"];
  return ["Browser / client", "text-muted"];
}

function HeadersTable() {
  const { journey } = useStore();
  const [probe, setProbe] = useState<OriginTrace | null>(null);
  useEffect(() => {
    if (journey?.origin) return;
    timed<OriginTrace>(`/api/trace?ts=${Date.now()}`).then((r) => setProbe(r.data)).catch(() => {});
  }, [journey?.origin]);
  const o = journey?.origin ?? probe;
  const rows = o ? Object.entries(o.headers).sort(([a], [b]) => a.localeCompare(b)) : [];
  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <div><div className="text-[13px] font-semibold">Headers received by the origin</div><div className="text-[12px] text-muted">{rows.length} headers · Ray <span className="font-mono">{o?.ray ?? "—"}</span> · the same data <span className="font-mono">/headers</span> returns as JSON</div></div>
        <LiveTag />
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full font-mono text-[11.5px]">
          <thead className="sticky top-0 bg-ink-800 text-left text-[10px] tracking-[0.1em] text-dim uppercase"><tr><th className="px-2 py-1.5">Header</th><th className="px-2 py-1.5">Value</th><th className="px-2 py-1.5">Added by</th></tr></thead>
          <tbody>
            {rows.map(([k, v]) => {
              const [src, cls] = classify(k, o?.via);
              return <tr key={k} className="border-t border-line/70"><td className={`px-2 py-1.5 whitespace-nowrap ${cls}`}>{k}</td><td className="px-2 py-1.5 break-all text-fg">{v}</td><td className={`px-2 py-1.5 font-sans whitespace-nowrap ${cls}`}>{src}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InspectorPage() {
  return (
    <>
      <PageHeader title="Request Inspector" sub="Follow a real request through Cloudflare to AWS, and see every header the origin received — and which hop added it." />
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,2.15fr)]"><TracePanel /><JourneyPanel /></div>
        <HeadersTable />
      </div>
    </>
  );
}

const PROBES = [
  { id: "legit", icon: CircleCheck, name: "Legitimate quote request", path: "/api/quote?pair=BTC-SGD", expect: 200 },
  { id: "xss", icon: Bug, name: "XSS in query string", path: XSS_PROBE, expect: 403 },
  { id: "sqli", icon: Syringe, name: "SQL injection", path: `/api/quote?pair=${encodeURIComponent("BTC-SGD' UNION SELECT api_key FROM accounts--")}`, expect: 403 },
  { id: "env", icon: FileWarning, name: "Secrets scan", path: "/.env", expect: 403 },
];

export function SecurityPage() {
  const { record, edge } = useStore();
  const [res, setRes] = useState<Record<string, { status: number; ray: string | null; ms: number }>>({});
  const run = async (p: (typeof PROBES)[number]) => {
    const r = await timed<unknown>(`${p.path}${p.path.includes("?") ? "&" : "?"}ts=${Date.now()}`);
    setRes((m) => ({ ...m, [p.id]: { status: r.status, ray: r.ray, ms: r.ms } }));
    record({ t: new Date().toISOString(), method: "GET", path: decodeURIComponent(p.path), status: r.status, ray: r.ray, colo: r.ray?.split("-").pop() ?? null, country: edge?.loc ?? null, ms: r.ms, verdict: verdictOf(r.status) });
  };
  const RULES = [
    ["Custom rule", "Block common attack probes — XSS, SQL injection, /.env, /.git, wp-login", "Block · JSON 403"],
    ["Cloudflare Managed Ruleset", "Cloudflare-maintained signatures for known vulnerabilities", "Execute"],
    ["Rate limiting", "/headers · 5 requests / 10 s per IP and data center", "Block 60 s · 429"],
    ["DDoS L7 protection", "Automatic, always-on HTTP DDoS mitigation", "Managed"],
  ];
  return (
    <>
      <PageHeader title="Security (WAF)" sub="Threats are stopped at the Cloudflare edge — they never reach the AWS origin. Fire real probes below and watch the edge answer." />
      <div className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
        <div className="panel p-3.5">
          <div className="mb-2 text-[13px] font-semibold">Active protections · strikemap.space</div>
          <ul className="divide-y divide-line">
            {RULES.map(([n, d, a]) => (
              <li key={n} className="flex items-center gap-3 py-2.5">
                <ShieldCheck className="size-4 shrink-0 text-ok" />
                <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{n}</div><div className="text-[12px] text-muted">{d}</div></div>
                <span className="shrink-0 rounded-md border border-line-strong px-2 py-0.5 font-mono text-[11px] text-muted">{a}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-3.5">
          <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold">Live probes against app.strikemap.space</span><LiveTag /></div>
          <ul className="divide-y divide-line">
            {PROBES.map((p) => {
              const r = res[p.id];
              return (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <p.icon className="size-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{p.name}</div>
                    <div className="truncate font-mono text-[11px] text-dim" title={decodeURIComponent(p.path)}>{decodeURIComponent(p.path)}</div>
                    {r && <div className="font-mono text-[11px] text-muted">{r.ray ?? "no ray"} · {Math.round(r.ms)} ms · {r.status === 403 ? "answered by Cloudflare WAF" : r.status === 200 ? "reached the origin" : ""}</div>}
                  </div>
                  {r ? <StatusCode code={r.status} /> : <span className="font-mono text-[11px] text-dim">expect {p.expect}</span>}
                  <button className="btn-ghost h-8 px-2.5 text-[12px]" onClick={() => run(p)}><Play className="size-3" fill="currentColor" />Send</button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11.5px] text-dim">Blocked probes appear under Logs &amp; Analytics as <span className="text-edge">Edge</span> rows — and never in the origin log.</p>
        </div>
      </div>
    </>
  );
}

export function RateLimitPage() {
  return (<><PageHeader title="Rate Limiting" sub="Bursts against /headers are absorbed at the edge. Simulate a large burst, then prove the production rule with real requests." /><RateLimitView full /></>);
}
export function TlsPage() {
  return (<><PageHeader title="TLS & Certificates" sub="Encrypted end to end: browser → Cloudflare → AWS, with the origin certificate validated in Full (strict) mode." /><TlsView full /></>);
}
export function StaffPage() {
  return (<><PageHeader title="Staff Portal (Access)" sub="Internal tools published through Cloudflare Tunnel and protected by identity-aware Cloudflare Access — no inbound ports on AWS." /><StaffView /></>);
}
export function LogsPage() {
  return (<><PageHeader title="Logs & Analytics" sub="What actually reached the origin, next to what the edge blocked for this browser. Search by Ray ID, endpoint, status or country." /><LogsView full /></>);
}

export function EconomicsPage() {
  return (
    <>
      <PageHeader title="Edge Economics" sub="NOVA is committed to AWS. Before adding another edge platform, model how much traffic Cloudflare can answer at the edge — and how much still reaches AWS and may incur data transfer charges." />
      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <EdgeEconomicsFull />
        <div className="flex flex-col gap-3">
          <ArchitectureFlow />
          <div className="panel p-3.5">
            <div className="label mb-2">How I'd position it</div>
            <ul className="space-y-2 text-[12.5px] text-muted">
              <li><span className="text-fg">“Edge-handled”, not “cached”:</span> blocked, challenged, cached and edge-computed responses never touch AWS.</li>
              <li><span className="text-fg">Dynamic workloads:</span> if 95% still reaches AWS, model the AWS data transfer explicitly — don't promise savings.</li>
              <li><span className="text-fg">Decide on the whole picture:</span> traffic profile, security, performance, operational complexity and total cost.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export function SettingsPage() {
  const { status, edge } = useStore();
  const env = {
    company: "NOVA (fictional digital-asset platform)",
    environment: "Production",
    origin: { provider: "AWS", service: "EC2", region: "ap-southeast-1", location: "Singapore", server: "Nginx + Node.js" },
    cloudflare: {
      zone: "strikemap.space", edge: edge?.colo ?? "—", tls: edge ? edge.tls : "—", sslMode: "Full (strict)",
      waf: true, rateLimiting: true, access: true, tunnel: status?.tunnel ? `${status.tunnel.ready} connections` : "—",
    },
  };
  return (
    <>
      <PageHeader title="Settings" sub="Read-only view of the environment. Configuration is managed through the Cloudflare API, Wrangler and the AWS CLI." />
      <div className="grid gap-3 xl:grid-cols-3">
        <ArchitectureFlow />
        <div className="panel p-3.5">
          <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold">Health checks</span><LiveTag /></div>
          <ul className="divide-y divide-line">
            {(status?.health.checks ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                {c.ok ? <CircleCheck className="size-4 text-ok" /> : <CircleAlert className="size-4 text-warn" />}
                <span className="font-medium">{c.name}</span>
                <span className="ml-auto font-mono text-[12px] text-muted">{c.detail}</span>
              </li>
            ))}
            {!status && <li className="py-3 text-[12px] text-dim">Checking…</li>}
          </ul>
        </div>
        <div className="panel p-3.5">
          <div className="mb-2 text-[13px] font-semibold">Environment</div>
          <pre className="overflow-auto rounded-lg border border-line bg-ink-850 p-3 font-mono text-[11.5px] leading-relaxed text-muted">{JSON.stringify(env, null, 2)}</pre>
        </div>
      </div>
    </>
  );
}
