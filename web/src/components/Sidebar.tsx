import { CircleCheck, CircleAlert, Gauge, House, LockKeyhole, ScrollText, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import type { ComponentType } from "react";
import { navigate, useRoute, type Route } from "../lib/router";
import { useStore } from "../lib/store";
import { Dot, Logo } from "./ui";

const NAV: { to: Route; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { to: "/", label: "Overview", icon: House },
  { to: "/inspector", label: "Request Inspector", icon: Search },
  { to: "/security", label: "Security (WAF)", icon: ShieldCheck },
  { to: "/rate-limiting", label: "Rate Limiting", icon: Gauge },
  { to: "/tls", label: "TLS & Certificates", icon: LockKeyhole },
  { to: "/staff", label: "Staff Portal (Access)", icon: UserRound },
  { to: "/logs", label: "Logs & Analytics", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const route = useRoute();
  const { status, statusError, edge } = useStore();

  const checks = [
    { label: "Cloudflare Edge", ok: !!edge, title: edge ? `Served by ${edge.colo}` : "Edge trace pending" },
    { label: "AWS Origin", ok: !!status && !statusError, title: "Origin API responding" },
    { label: "WAF Rules", ok: true, title: "Custom rule + Cloudflare Managed Ruleset deployed" },
    { label: "Rate Limiting", ok: true, title: "5 req / 10 s per IP on /headers" },
    { label: "Tunnel & Access", ok: !!status?.tunnel && status.tunnel.ready > 0, title: status?.tunnel ? `${status.tunnel.ready} tunnel connections` : "Tunnel status pending" },
  ];
  const healthy = checks.every((c) => c.ok) && !!status?.health.healthy;
  const loading = !status && !statusError;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[212px] flex-col border-r border-line bg-ink-900 lg:flex">
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex items-center gap-2.5 px-4 pt-4 pb-5">
        <Logo />
        <span className="leading-tight">
          <span className="block text-[16px] font-semibold tracking-tight">SiamPay</span>
          <span className="block text-[11.5px] text-muted">Edge Console</span>
        </span>
      </a>

      <nav className="flex flex-col gap-0.5 px-2.5" aria-label="Console">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = route === to;
          return (
            <a key={to} href={to} aria-current={active ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); navigate(to); }}
              className={`group flex h-9 items-center gap-3 rounded-lg border px-3 text-[13px] font-medium transition ${
                active
                  ? "border-accent/60 bg-accent/15 text-white shadow-[0_0_20px_-6px_rgb(47_124_246/0.7)]"
                  : "border-transparent text-muted hover:bg-white/[0.03] hover:text-fg"}`}>
              <Icon className={`size-[17px] ${active ? "text-white" : "text-dim group-hover:text-muted"}`} />
              {label}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <div className="panel p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold">SiamPay</div>
              <div className="text-[11px] text-dim">Production</div>
            </div>
            <Dot tone={loading ? "dim" : healthy ? "ok" : "warn"} pulse={healthy} />
          </div>
          <div className={`mt-2.5 text-[13px] font-semibold ${loading ? "text-muted" : healthy ? "text-[#4ade80]" : "text-warn"}`}>
            {loading ? "Checking…" : healthy ? "System Healthy" : "Attention needed"}
          </div>
          <ul className="mt-2 space-y-1.5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-[12px] text-muted" title={c.title}>
                {c.ok ? <CircleCheck className="size-3.5 text-ok" /> : <CircleAlert className="size-3.5 text-warn" />}
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
