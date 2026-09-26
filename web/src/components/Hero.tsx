import { ArrowRight, Check, Zap } from "lucide-react";
import { navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { Globe } from "./Globe";

const CHIPS = [
  { t: "Secure", d: "WAF · DDoS · Bot" },
  { t: "Fast", d: "Global edge" },
  { t: "Reliable", d: "99.99% SLO" },
  { t: "Scalable", d: "Built for growth" },
];

export function Hero() {
  const { edge, status, journey, runExample, setTab, setAttackOpen, running } = useStore();
  const explore = () => {
    setTab("journey");
    navigate("/", { hash: "workspace" });
    runExample("normal");
  };
  const originMs = journey?.origin && journey.originMs != null ? journey.originMs + journey.origin.appMs : null;
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(320px,0.95fr)_minmax(340px,1.05fr)]">
      <div className="flex flex-col justify-center">
        <p className="text-[11.5px] font-semibold tracking-[0.22em] text-brand uppercase">Singapore · Digital Assets · Global Trading</p>
        <h1 className="mt-1.5 text-[clamp(38px,3.5vw,64px)] leading-[1.0] font-bold tracking-[-0.04em]">
          <span className="block">NOVA</span>
          {/* w-fit keeps the gradient on the words; pb/-mb keeps the "g" descender inside the painted area */}
          <span className="block w-fit bg-[linear-gradient(95deg,#ff9d4d_0%,#f6821f_45%,#f26b0f_100%)] bg-clip-text pr-[0.04em] pb-[0.16em] -mb-[0.16em] text-transparent">
            Edge Console
          </span>
        </h1>
        <p className="mt-2.5 text-[17px] font-semibold tracking-tight">Secure. Fast. Global.</p>
        <p className="mt-1 max-w-[470px] text-[13px] leading-relaxed text-muted">
          Real-time visibility into how Cloudflare protects and accelerates NOVA's global trading platform.
        </p>
        <div className="mt-3 grid max-w-[520px] grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
          {CHIPS.map((c) => (
            <div key={c.t} className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white"><Check className="size-3" strokeWidth={3.2} /></span>
              <span className="leading-tight">
                <span className="block text-[12.5px] font-semibold">{c.t}</span>
                <span className="block text-[10.5px] whitespace-nowrap text-dim">{c.d}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          <button className="btn-primary h-10 px-4" onClick={explore} disabled={running !== null}>
            Explore a Request <ArrowRight className="size-4" />
          </button>
          <button className="btn-ghost h-10 px-4" onClick={() => setAttackOpen(true)}>
            <Zap className="size-4 text-brand" fill="currentColor" /> Simulate Attack
          </button>
        </div>
      </div>

      <div className="relative min-h-[284px]">
        <Globe sgRtt={edge?.colo === "SIN" ? edge.ms : null} originHealthy={status ? status.health.healthy : null} originMs={originMs} />
        <p className="pointer-events-none absolute bottom-0.5 left-2 flex items-center gap-1.5 text-[10.5px] text-dim"><span className="sim-tag">Demo traffic</span>typical RTT to Singapore · SIN = your live edge round trip</p>
      </div>
    </section>
  );
}
