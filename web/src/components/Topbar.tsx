import { ChevronDown, ExternalLink, KeyRound, Menu, Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PORTAL_URL, REPO_URL } from "../lib/api";
import { coloCity, countryName, httpLabel, isPostQuantum, tlsLabel } from "../lib/format";
import { navigate, ROUTES, type Route } from "../lib/router";
import { useStore } from "../lib/store";
import { Flag } from "./ui";

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
  return <div ref={ref} className={`panel-hi absolute top-[calc(100%+8px)] right-0 z-50 w-72 p-2 shadow-2xl shadow-black/60 animate-fade-in ${className}`}>{children}</div>;
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-[12px]"><span className="text-muted">{k}</span><span className="font-mono text-[11.5px] text-fg">{v}</span></div>
);

export function Topbar() {
  const { edge, identity } = useStore();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<"region" | "user" | "nav" | null>(null);
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
          {ROUTES.map((r: Route) => (
            <button key={r} className="block w-full rounded-md px-2 py-2 text-left text-[13px] hover:bg-white/5" onClick={() => { setMenu(null); navigate(r); }}>
              {{ "/": "Overview", "/inspector": "Request Inspector", "/security": "Security (WAF)", "/rate-limiting": "Rate Limiting", "/tls": "TLS & Certificates", "/staff": "Staff Portal (Access)", "/logs": "Logs & Analytics", "/settings": "Settings" }[r]}
            </button>
          ))}
        </Popover>
      </div>

      <form onSubmit={submit} className="relative w-full max-w-[420px]" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by Ray ID, request ID, endpoint…" aria-label="Search logs by Ray ID or endpoint"
          className="h-9 w-full rounded-lg border border-line-strong bg-ink-800/80 pr-14 pl-9 text-[13px] text-fg placeholder:text-dim focus:border-accent/60 focus:outline-none" />
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
          <button className="flex h-10 items-center gap-2.5 rounded-lg px-2 hover:bg-white/[0.03]" onClick={() => setMenu(menu === "user" ? null : "user")} aria-expanded={menu === "user"}>
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#2f7cf6] to-[#8b5cf6] text-[12px] font-bold text-white ring-2 ring-line-strong">DH</span>
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-[13px] font-semibold">Darshan Hegde</span>
              <span className="block text-[11px] text-muted">Solutions Engineer</span>
            </span>
            <ChevronDown className="size-3.5 text-muted" />
          </button>
          <Popover open={menu === "user"} onClose={() => setMenu(null)} className="w-64">
            <div className="px-2 pt-1 pb-2 text-[12px] text-muted">
              {identity ? <>Access session: <span className="text-fg">{identity.email}</span></> : "Presenter · no Access session in this browser"}
            </div>
            <a href={PORTAL_URL} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] hover:bg-white/5"><KeyRound className="size-4 text-muted" />Staff Portal (Cloudflare Access)</a>
            <a href={REPO_URL} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] hover:bg-white/5"><ExternalLink className="size-4 text-muted" />Source on GitHub</a>
          </Popover>
        </div>
      </div>
    </header>
  );
}
