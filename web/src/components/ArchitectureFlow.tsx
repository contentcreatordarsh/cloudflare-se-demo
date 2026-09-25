import { ArrowDown, ChartCandlestick, Cloud, Server, UsersRound } from "lucide-react";
import { coloCity } from "../lib/format";
import { useStore } from "../lib/store";
import { Dot } from "./ui";

/** Global Users -> Cloudflare Edge -> AWS EC2 Origin -> NOVA Platform, with live status where it exists. */
export function ArchitectureFlow() {
  const { edge, status, journey } = useStore();
  const origin = status?.health.healthy;
  const layers = [
    { icon: UsersRound, title: "Global Users", sub: "Customers around the world", tone: "text-accent-soft bg-accent/12 border-accent/30", meta: null as string | null },
    { icon: Cloud, title: "Cloudflare Edge", sub: "Security · Performance · Reliability", tone: "text-brand bg-brand/12 border-brand/45", meta: edge ? `${edge.colo}` : null, hi: true },
    { icon: Server, title: "AWS EC2 Origin", sub: "ap-southeast-1 (Singapore)", tone: "text-aws bg-aws/10 border-aws/35", meta: origin == null ? null : origin ? "Healthy" : "Check" },
    { icon: ChartCandlestick, title: "NOVA Platform", sub: "Fictional digital-asset trading platform", tone: "text-violet bg-violet/12 border-violet/35", meta: journey?.origin ? `${journey.status} OK` : null },
  ];
  return (
    <div className="panel flex flex-col px-3.5 py-3" aria-label="Architecture">
      <div className="label mb-2">Architecture</div>
      {layers.map((l, i) => (
        <div key={l.title}>
          <div className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${l.hi ? "border border-brand/25 bg-brand/[0.06]" : ""}`}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-full border ${l.tone}`}><l.icon className="size-[18px]" /></span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[13px] font-semibold">{l.title}</span>
              <span className="block truncate text-[11.5px] text-muted">{l.sub}</span>
            </span>
            {l.meta && (
              <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted" title={i === 1 ? `Your requests are served by ${coloCity(l.meta)}` : undefined}>
                <Dot tone={l.meta === "Check" ? "warn" : "ok"} />{l.meta}
              </span>
            )}
          </div>
          {i < layers.length - 1 && (
            <div className="flex h-5 items-center pl-[25px]" aria-hidden>
              <span className="relative h-full w-px bg-gradient-to-b from-brand/60 to-brand/20">
                <ArrowDown className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 text-brand" />
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
