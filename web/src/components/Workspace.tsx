import { Gauge, LockKeyhole, Route, ScrollText, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import { useStore, type Tab } from "../lib/store";
import { EdgeEconomicsPanel } from "./EdgeEconomics";
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
  const { tab, setTab, runExample, running, refreshIdentity, journey } = useStore();
  const activeKind = tab === "staff" ? "staff" : journey?.source === "live" ? journey.kind : null;
  const chip = (k: string) => `chip h-7 px-2 text-[11.5px] ${activeKind === k ? "border-brand/70 bg-brand/15 text-white" : ""}`;
  const example = (kind: "normal" | "waf" | "ratelimit" | "staff") => {
    if (kind === "staff") { setTab("staff"); refreshIdentity(); return; }
    setTab("journey");
    runExample(kind);
  };
  return (
    <section id="workspace" className="scroll-mt-20 rounded-lg border border-line bg-ink-900/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2">
        <div role="tablist" className="flex overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
                className={`relative flex h-10 shrink-0 items-center gap-1.5 px-2 text-[12.5px] font-medium transition ${active ? "text-white" : "text-muted hover:text-fg"}`}>
                <Icon className={`size-4 ${active ? "text-brand" : ""}`} />{label}
                {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand shadow-[0_0_12px_rgb(246_130_31)]" />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 py-1 pr-1">
          <span className="mr-0.5 text-[12px] text-muted">Try an example:</span>
          <button className={chip("normal")} disabled={!!running} onClick={() => example("normal")}>Normal Request</button>
          <button className={chip("waf")} disabled={!!running} onClick={() => example("waf")}>Blocked Request</button>
          <button className={chip("ratelimit")} disabled={!!running} onClick={() => example("ratelimit")}>Rate Limited</button>
          <button className={chip("staff")} onClick={() => example("staff")}>Staff Access</button>
        </div>
      </div>
      <div className="p-2" role="tabpanel">
        {tab === "journey" && (
          <div className="grid gap-2.5 xl:grid-cols-[236px_minmax(0,1fr)_320px]">
            <TracePanel />
            <JourneyPanel />
            <EdgeEconomicsPanel />
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
