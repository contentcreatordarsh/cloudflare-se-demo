import { Ban, Bell, ChevronDown, CircleCheck, ExternalLink, Gauge, KeyRound, LogOut, Menu, Search, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PORTAL_URL, REPO_URL } from "../lib/api";
import { ago, coloCity, countryName, httpLabel, isPostQuantum, tlsLabel } from "../lib/format";
import { navigate } from "../lib/router";
import { journeyFromEvent, useStore, type SessionEvent } from "../lib/store";
import { NAV } from "./Sidebar";
import { Flag, Logo, StatusCode } from "./ui";

function Popover({ open, onClose, children, className = "" }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={ref} className={`absolute top-[calc(100%+8px)] right-0 z-50 w-72 rounded-lg border border-line-strong bg-ink-900 p-2 shadow-2xl shadow-black/70 animate-fade-in ${className}`}>{children}</div>;
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-[12px]"><span className="text-muted">{k}</span><span className="font-mono text-[11.5px] text-fg">{v}</span></div>
);

const VERDICT: Record<SessionEvent["verdict"], { text: string; icon: typeof Ban; tone: string }> = {
  blocked_waf: { text: "Blocked by WAF · never reached AWS", icon: ShieldX, tone: "text-bad" },
  rate_limited: { text: "Rate limited · never reached AWS", icon: Gauge, tone: "text-warn" },
  allowed: { text: "Allowed · reached AWS", icon: CircleCheck, tone: "text-ok" },
  error: { text: "Not allowed through", icon: Ban, tone: "text-muted" },
};

const initials = (email: string | null | undefined) =>
  email ? email.split("@")[0].split(/[._+-]/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") : "";
const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");

export function Topbar() {
  const { edge, identity, me, events, running, runExample, openRequest } = useStore();
  const blocked = events.filter((e) => e.verdict === "blocked_waf" || e.verdict === "rate_limited");
  const [seenAt, setSeenAt] = useState("");
  const unread = blocked.filter((e) => e.t > seenAt).length;
  // One row per request; a rate-limit burst is shown as its final (blocked) request.
  const activity = events.filter((e) => !e.path.startsWith("/headers?burst=") || e.verdict === "rate_limited").slice(0, 8);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<"region" | "user" | "nav" | "alerts" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    window.history.pushState(null, "", `/logs${term ? `?q=${encodeURIComponent(term)}` : ""}`);
    navigate("/logs");
    input.current?.blur();
  };

  const cc = edge?.loc;
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-line bg-ink-950/80 px-4 backdrop-blur-md lg:px-5">
      <div className="relative lg:hidden">
        <button className="btn-ghost h-9 w-9 px-0" aria-label="Menu" onClick={() => setMenu(menu === "nav" ? null : "nav")}><Menu className="size-4" /></button>
        <Popover open={menu === "nav"} onClose={() => setMenu(null)} className="right-auto left-0 w-56">
          {NAV.map((n) => (
            <button key={n.to} className="block w-full rounded-md px-2 py-2 text-left text-[13px] hover:bg-white/5" onClick={() => { setMenu(null); navigate(n.to); }}>
              {n.label}
            </button>
          ))}
        </Popover>
      </div>

      <form onSubmit={submit} className="relative w-full max-w-[420px]" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by Ray ID, request ID, endpoint…" aria-label="Search logs by Ray ID or endpoint"
          className="h-9 w-full rounded-md border border-line-strong bg-ink-800/80 pr-14 pl-9 text-[13px] text-fg placeholder:text-dim focus:border-brand/60 focus:outline-none" />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-line-strong bg-ink-750 px-1.5 py-px font-mono text-[10.5px] text-muted">⌘ K</kbd>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button className="btn-ghost h-9 gap-2 px-3 font-medium" onClick={() => setMenu(menu === "region" ? null : "region")} aria-expanded={menu === "region"}>
            <Flag cc={cc} />
            <span className="hidden sm:inline">{cc ? `${countryName(cc)} (${cc})` : "Detecting…"}</span>
            <ChevronDown className="size-3.5 text-muted" />
          </button>
          <Popover open={menu === "region"} onClose={() => setMenu(null)}>
            <div className="label px-2 pt-1 pb-1.5">This browser, as seen by Cloudflare</div>
            <Row k="Country (loc)" v={cc ? `${countryName(cc)} · ${cc}` : "—"} />
            <Row k="Edge data center" v={edge ? `${coloCity(edge.colo)} · ${edge.colo}` : "—"} />
            <Row k="Protocol" v={edge ? `${httpLabel(edge.http)} · ${tlsLabel(edge.tls)}` : "—"} />
            <Row k="Key exchange" v={edge ? `${edge.kex}${isPostQuantum(edge.kex) ? " · PQ" : ""}` : "—"} />
            <Row k="Edge round trip" v={edge ? `${Math.round(edge.ms)} ms` : "—"} />
            <p className="mt-1 border-t border-line px-2 pt-2 pb-1 text-[11.5px] text-dim">From <span className="font-mono">/cdn-cgi/trace</span>, answered by the Cloudflare edge itself. Connect from another country to see it change.</p>
          </Popover>
        </div>

        <div className="relative">
          <button className="btn-ghost relative h-9 w-9 px-0" aria-label={`Edge activity${unread ? `: ${unread} new ${unread === 1 ? "block" : "blocks"}` : ""}`}
            onClick={() => { setMenu(menu === "alerts" ? null : "alerts"); setSeenAt(new Date().toISOString()); }} aria-expanded={menu === "alerts"}>
            <Bell className="size-4" />
            {unread > 0 && <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[9.5px] font-bold text-white">{unread}</span>}
          </button>
          <Popover open={menu === "alerts"} onClose={() => setMenu(null)} className="w-[340px]">
            <div className="flex items-baseline justify-between gap-2 px-2 pt-1 pb-1.5">
              <span className="label">Edge activity · this session</span>
              <span className="text-[11px] text-dim">{blocked.length} blocked · {events.length - blocked.length} allowed</span>
            </div>
            {activity.length === 0 && (
              <div className="px-2 py-2 text-[12px] text-muted">
                <p>Requests this browser sends through Cloudflare appear here. Click one to see its full journey.</p>
                <div className="mt-2.5 flex gap-1.5">
                  <button className="btn-ghost h-8 px-2.5 text-[12px]" disabled={!!running} onClick={() => { setMenu(null); runExample("waf"); navigate("/"); }}><ShieldCheck className="size-3.5" />Send a blocked request</button>
                  <button className="btn-ghost h-8 px-2.5 text-[12px]" disabled={!!running} onClick={() => { setMenu(null); runExample("ratelimit"); navigate("/"); }}><Gauge className="size-3.5" />Trigger rate limit</button>
                </div>
              </div>
            )}
            {activity.map((a) => {
              const v = VERDICT[a.verdict];
              return (
                <button key={a.id} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-white/5"
                  title="Open this request in the Request Journey" onClick={() => { setMenu(null); openRequest(journeyFromEvent(a, edge)); }}>
                  <v.icon className={`size-4 shrink-0 ${v.tone}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[11.5px]">{a.method} {a.path.split("?")[0]}</span>
                    <span className={`block truncate text-[11px] ${v.tone}`}>{v.text}</span>
                    <span className="block truncate font-mono text-[10.5px] text-dim">{a.ray ?? "no Ray ID"} · {ago(a.t)}</span>
                  </span>
                  <StatusCode code={a.status} />
                </button>
              );
            })}
            {activity.length > 0 && <p className="mt-1 border-t border-line px-2 pt-2 pb-1 text-[11px] text-dim">Blocked requests are answered by the Cloudflare edge, so they never appear in the origin log.</p>}
          </Popover>
        </div>

        <div className="relative">
          <button className="flex h-10 items-center gap-2.5 rounded-lg px-2 hover:bg-white/[0.03]" onClick={() => setMenu(menu === "user" ? null : "user")} aria-expanded={menu === "user"}>
            <span className="grid size-8 place-items-center rounded-full border border-brand/55 bg-brand/[0.12] text-[11.5px] font-bold tracking-wide text-brand-soft">
              {initials(me?.email ?? identity?.email) || <Logo size={16} />}
            </span>
            <span className="hidden max-w-[210px] text-left leading-tight md:block">
              <span className="block truncate text-[13px] font-semibold">{me?.email ?? identity?.email ?? (me === undefined ? "Checking identity…" : "NOVA viewer")}</span>
              <span className="block text-[11px] text-muted">{me ? "Verified by Cloudflare Access" : "Signed in through Cloudflare Access"}</span>
            </span>
            <ChevronDown className="size-3.5 text-muted" />
          </button>
          <Popover open={menu === "user"} onClose={() => setMenu(null)} className="w-[300px]">
            <div className="flex items-center gap-2 px-2 pt-1 pb-2"><Logo size={18} /><span className="label">Your Cloudflare Access session</span></div>
            <Row k="Email" v={me?.email ?? identity?.email ?? "—"} />
            <Row k="Sign-in method" v="One-time PIN" />
            <Row k="Country" v={me?.country ? `${countryName(me.country)} · ${me.country}` : "—"} />
            <Row k="Signed in" v={clock(me?.authenticatedAt)} />
            <Row k="Session ends" v={clock(me?.expiresAt)} />
            <p className="mx-2 mt-1 mb-1.5 rounded-md border border-line bg-white/[0.02] px-2 py-1.5 text-[11px] text-dim">
              {me ? `The origin verified your Access token (${me.verified}). Allowed: the project owner and @cloudflare.com.` : "Only the project owner and @cloudflare.com addresses can open this console."}
            </p>
            <a href={PORTAL_URL} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] hover:bg-white/5"><KeyRound className="size-4 text-muted" />Staff Portal (Access → Worker → Tunnel)</a>
            <a href={REPO_URL} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] hover:bg-white/5"><ExternalLink className="size-4 text-muted" />Source on GitHub</a>
            <a href="/cdn-cgi/access/logout" className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] text-bad hover:bg-bad/10"><LogOut className="size-4" />Sign out</a>
          </Popover>
        </div>
      </div>
    </header>
  );
}
