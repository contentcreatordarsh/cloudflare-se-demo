import { ArrowDown, ArrowRight, Check, Cloud, CreditCard, Server, UsersRound, Zap } from "lucide-react";
import { coloCity } from "../lib/format";
import { navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { Globe } from "./Globe";
import { Dot } from "./ui";

function ArchitecturePanel() {
  const { edge, status, journey } = useStore();
  const origin = status?.health.healthy;
  const layers = [
    { icon: UsersRound, title: "Global Users", sub: "Customers around the world", tone: "text-accent-soft bg-accent/12 border-accent/30", meta: null },
    { icon: Cloud, title: "Cloudflare Edge", sub: "Security · Performance · Reliability", tone: "text-edge bg-edge/12 border-edge/40", meta: edge ? edge.colo : null, hi: true },
    { icon: Server, title: "AWS EC2 Origin", sub: "ap-southeast-1 (Singapore)", tone: "text-aws bg-aws/10 border-aws/35", meta: origin == null ? null : origin ? "Healthy" : "Check" },
    { icon: CreditCard, title: "SiamPay Application", sub: "Fictional Thai fintech platform", tone: "text-violet bg-violet/12 border-violet/35", meta: journey?.origin ? `${journey.status} OK` : null },
  ];
  return (
    <div className="panel flex h-full flex-col justify-between px-3.5 py-3" aria-label="Architecture">
      {layers.map((l, i) => (
        <div key={l.title}>
          <div className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${l.hi ? "border border-edge/25 bg-edge/[0.06]" : ""}`}>
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
              <span className="relative h-full w-px bg-gradient-to-b from-accent/60 to-accent/20">
                <ArrowDown className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 text-accent-soft" />
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Hero() {
  const { edge, status, runExample, setTab, setAttackOpen, running } = useStore();
  const explore = () => {
    setTab("journey");
    navigate("/", { hash: "workspace" });
    runExample("normal");
  };
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(300px,1fr)_minmax(340px,1.15fr)] xl:grid-cols-[minmax(300px,0.9fr)_minmax(380px,1.35fr)_minmax(250px,0.72fr)]">
      <div className="flex flex-col justify-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#a78bfa] uppercase">Thai Fintech · Global Payments</p>
        <h1 className="mt-2 text-[clamp(36px,3.45vw,50px)] leading-[1.02] font-bold tracking-[-0.035em]">
          <span className="block">SiamPay</span>
          {/* w-fit: the gradient spans the words, not the column. pb/-mb: the clipped background reaches below the
              baseline so descenders (the "g") stay visible without changing the line spacing. */}
          <span className="block w-fit bg-[linear-gradient(95deg,#4f8fff_0%,#6d7eff_40%,#9a86ff_72%,#c0a4ff_100%)] bg-clip-text pr-[0.04em] pb-[0.16em] -mb-[0.16em] text-transparent [filter:drop-shadow(0_0_22px_rgb(99_120_255/0.28))]">
            Edge Console
          </span>
        </h1>
        <p className="mt-2.5 text-[16px] font-semibold tracking-tight">Secure. Fast. Global.</p>
        <p className="mt-1 max-w-[400px] text-[13px] leading-relaxed text-muted">
          Real-time visibility into how Cloudflare protects and accelerates our AWS-hosted application.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["Secure", "Fast", "Global", "Reliable"].map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-md border border-ok/20 bg-ok/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-[#86efac]">
              <Check className="size-3" strokeWidth={3} />{c}
            </span>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          <button className="btn-primary h-10 px-4" onClick={explore} disabled={running !== null}>
            Explore a Request <ArrowRight className="size-4" />
          </button>
          <button className="btn-ghost h-10 px-4" onClick={() => setAttackOpen(true)}>
            <Zap className="size-4 text-warn" fill="currentColor" /> Simulate Attack
          </button>
        </div>
      </div>

      <div className="relative min-h-[288px]">
        <Globe sgRtt={edge?.colo === "SIN" ? edge.ms : null} originHealthy={status ? status.health.healthy : null} />
        <p className="pointer-events-none absolute bottom-1 left-2 text-[10.5px] text-dim">Typical RTT to Singapore · SG shows your live edge round trip</p>
      </div>

      <div className="hidden xl:block"><ArchitecturePanel /></div>
    </section>
  );
}
