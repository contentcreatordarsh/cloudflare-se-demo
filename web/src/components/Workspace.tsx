import { Gauge, LockKeyhole, Route, ScrollText, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import { useStore, type Tab } from "../lib/store";
import { JourneyPanel, TracePanel } from "./Journey";
import { LogsView } from "./LogsView";
import { RateLimitView } from "./RateLimitView";
import { StaffView } from "./StaffView";
import { TlsView } from "./TlsView";

const TABS: { id: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "journey", label: "Request Journey", icon: Route },
  { id: "tls", label: "TLS & Security", icon: ShieldCheck },
  { id: "ratelimit", label: "Rate Limiting", icon: Gauge },
  { id: "logs", label: "Edge Logs", icon: ScrollText },
  { id: "staff", label: "Staff Portal", icon: LockKeyhole },
];

export function Workspace() {
  const { tab, setTab, runExample, running, refreshIdentity } = useStore();
  const example = (kind: "normal" | "waf" | "ratelimit" | "staff") => {
    if (kind === "staff") { setTab("staff"); refreshIdentity(); return; }
    setTab("journey");
    runExample(kind);
  };
  return (
    <section id="workspace" className="scroll-mt-20 rounded-[12px] border border-line bg-ink-900/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2">
        <div role="tablist" className="flex overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
                className={`relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium transition ${active ? "text-white" : "text-muted hover:text-fg"}`}>
                <Icon className={`size-4 ${active ? "text-accent-soft" : ""}`} />{label}
                {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent shadow-[0_0_12px_rgb(47_124_246)]" />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 py-1 pr-1">
          <span className="mr-0.5 text-[12px] text-muted">Try an example:</span>
          <button className="chip h-7 px-2 text-[11.5px]" disabled={!!running} onClick={() => example("normal")}>Normal Request</button>
          <button className="chip h-7 px-2 text-[11.5px]" disabled={!!running} onClick={() => example("waf")}>Blocked Request</button>
          <button className="chip h-7 px-2 text-[11.5px]" disabled={!!running} onClick={() => example("ratelimit")}>Rate Limited</button>
          <button className="chip h-7 px-2 text-[11.5px]" onClick={() => example("staff")}>Staff Access</button>
        </div>
      </div>
      <div className="p-2.5" role="tabpanel">
        {tab === "journey" && (
          <div className="grid gap-3 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,2.15fr)]">
            <TracePanel />
            <JourneyPanel />
          </div>
        )}
        {tab === "tls" && <TlsView />}
        {tab === "ratelimit" && <RateLimitView />}
        {tab === "logs" && <LogsView />}
        {tab === "staff" && <StaffView />}
      </div>
    </section>
  );
}
