import type { ReactNode } from "react";
import { Globe } from "lucide-react";
import { flagUrl } from "../lib/format";

export function Logo({ size = 34 }: { size?: number }) {
  // Abstract mark: a cloud (edge network) carrying a payment line and an edge node.
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f7cf6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#0a1421" stroke="#1f3150" />
      <path d="M9.5 25.5c0-3.6 2.8-6.5 6.4-6.6a7.6 7.6 0 0 1 14.6 2A4.7 4.7 0 0 1 29.7 30H13.9a4.4 4.4 0 0 1-4.4-4.5Z"
        fill="none" stroke="url(#lg-a)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M16 26.2h8.5" stroke="#22d3ee" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="29.5" cy="11" r="2.8" fill="#f6821f" />
      <path d="M26.9 12.4 23 16.2" stroke="#f6821f" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function Flag({ cc, className = "h-3.5 w-[18px]" }: { cc?: string | null; className?: string }) {
  const src = flagUrl(cc);
  if (!src) return <Globe className="size-3.5 text-dim" aria-hidden />;
  return <img src={src} alt="" className={`${className} shrink-0 rounded-[2px] object-cover ring-1 ring-white/10`} />;
}

export function Dot({ tone = "ok", pulse = false }: { tone?: "ok" | "bad" | "warn" | "dim" | "accent"; pulse?: boolean }) {
  const c = { ok: "bg-ok", bad: "bg-bad", warn: "bg-warn", dim: "bg-dim", accent: "bg-accent-soft" }[tone];
  return <span className={`inline-block size-1.5 shrink-0 rounded-full ${c} ${pulse ? "live-dot" : ""}`} />;
}

export const SimTag = ({ children = "Simulated" }: { children?: ReactNode }) => (
  <span className="sim-tag" title="Illustrative data for the presentation — not measured">{children}</span>
);
export const LiveTag = ({ children = "Live" }: { children?: ReactNode }) => (
  <span className="live-tag" title="Measured live from the real Cloudflare / AWS setup"><Dot pulse />{children}</span>
);

export function StatusCode({ code }: { code: number }) {
  const tone =
    code >= 200 && code < 300 ? "border-ok/30 bg-ok/10 text-[#86efac]"
    : code === 429 ? "border-warn/35 bg-warn/10 text-[#fcd34d]"
    : code >= 400 ? "border-bad/35 bg-bad/10 text-[#fca5a5]"
    : "border-line-strong text-muted";
  return <span className={`inline-flex min-w-10 justify-center rounded-md border px-1.5 py-0.5 font-mono text-[11.5px] font-semibold num ${tone}`}>{code || "ERR"}</span>;
}

export function SectionHead({ n, title, sub, right }: { n?: number; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {n != null && (
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-line-strong bg-ink-750 font-mono text-[11px] text-accent-soft">{n}</span>
        )}
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-fg">{title}</h3>
          {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">{sub}</p>
      </div>
      {right}
    </div>
  );
}

export function Kv({ k, v, mono = false, tone }: { k: ReactNode; v: ReactNode; mono?: boolean; tone?: "ok" | "bad" | "warn" }) {
  const t = tone === "ok" ? "text-[#86efac]" : tone === "bad" ? "text-[#fca5a5]" : tone === "warn" ? "text-[#fcd34d]" : "text-fg";
  return (
    <div className="flex items-center justify-between gap-3 py-[5px] text-[12px]">
      <span className="shrink-0 text-muted">{k}</span>
      <span className={`min-w-0 truncate text-right font-medium ${mono ? "font-mono text-[11.5px]" : ""} ${t}`}>{v}</span>
    </div>
  );
}
