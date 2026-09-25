import { CircleAlert, CircleCheck, CircleDollarSign, Gauge, House, LockKeyhole, ScrollText, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { ago } from "../lib/format";
import { navigate, useRoute, type Route } from "../lib/router";
import { useStore } from "../lib/store";
import { Logo } from "./ui";

export const NAV: { to: Route; label: string; icon: ComponentType<{ className?: string }>; isNew?: boolean }[] = [
  { to: "/", label: "Overview", icon: House },
  { to: "/inspector", label: "Request Inspector", icon: Search },
  { to: "/security", label: "Security (WAF)", icon: ShieldCheck },
  { to: "/rate-limiting", label: "Rate Limiting", icon: Gauge },
  { to: "/tls", label: "TLS & Certificates", icon: LockKeyhole },
  { to: "/staff", label: "Staff Portal (Access)", icon: UserRound },
  { to: "/logs", label: "Logs & Analytics", icon: ScrollText },
  { to: "/economics", label: "Edge Economics", icon: CircleDollarSign, isNew: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const route = useRoute();
  const { status, statusError, edge, logs } = useStore();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t); }, []);

  const checks = [
    { label: "Cloudflare Edge", ok: !!edge, title: edge ? `Served by ${edge.colo}` : "Edge trace pending" },
    { label: "AWS Origin", ok: !!status && !statusError, title: "Origin API responding" },
    { label: "WAF Rules", ok: true, title: "Custom rule + Cloudflare Managed Ruleset deployed" },
    { label: "Rate Limiting", ok: true, title: "5 req / 10 s per IP on /headers" },
    { label: "Tunnel & Access", ok: !!status?.tunnel && status.tunnel.ready > 0, title: status?.tunnel ? `${status.tunnel.ready} tunnel connections` : "Tunnel status pending" },
    { label: "Observability", ok: logs.length > 0 || !!status, title: "Origin request log streaming" },
  ];
  const healthy = checks.every((c) => c.ok) && !!status?.health.healthy;
  const loading = !status && !statusError;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-ink-900/95 lg:flex">
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex h-[60px] items-center gap-2.5 border-b border-line px-4">
        <Logo size={36} />
        <span className="leading-tight">
          <span className="block text-[17px] font-semibold tracking-[0.06em]">NOVA</span>
          <span className="block text-[12px] text-muted">Edge Console</span>
        </span>
      </a>

      <nav className="mt-3 flex flex-col gap-0.5 px-2.5" aria-label="Console">
        {NAV.map(({ to, label, icon: Icon, isNew }) => {
          const active = route === to;
          return (
            <a key={to} href={to} aria-current={active ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); navigate(to); }}
              className={`group flex h-9 items-center gap-3 rounded-md border px-3 text-[13px] font-medium transition ${
                active
                  ? "border-brand/55 bg-brand/[0.12] text-white shadow-[inset_2px_0_0_var(--color-brand)]"
                  : "border-transparent text-muted hover:bg-white/[0.03] hover:text-fg"}`}>
              <Icon className={`size-[17px] ${active ? "text-brand" : "text-dim group-hover:text-muted"}`} />
              <span className="flex-1">{label}</span>
              {isNew && <span className="rounded bg-brand px-1.5 py-px text-[9.5px] font-bold tracking-wide text-white uppercase">New</span>}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <div className="panel p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold">NOVA</div>
              <div className="text-[11px] text-dim">Production</div>
            </div>
            <span className={`grid size-5 place-items-center rounded-md ${healthy ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}><ShieldCheck className="size-3.5" /></span>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-[12px] text-muted" title={c.title}>
                {c.ok ? <CircleCheck className="size-3.5 text-ok" /> : <CircleAlert className="size-3.5 text-warn" />}
                {c.label}
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-2.5">
            <div className={`flex items-center gap-2 text-[13px] font-semibold ${loading ? "text-muted" : healthy ? "text-ok" : "text-warn"}`}>
              <span className={`inline-block size-2 rounded-full ${loading ? "bg-dim" : healthy ? "bg-ok live-dot" : "bg-warn"}`} />
              {loading ? "Checking…" : healthy ? "System Healthy" : "Attention needed"}
            </div>
            <div className="mt-0.5 text-[11px] text-dim">{healthy ? "All services operational" : "See Settings → Health"}</div>
            {status && <div className="text-[11px] text-dim">Last checked {ago(status.serverTime)}</div>}
          </div>
        </div>
      </div>
    </aside>
  );
}
