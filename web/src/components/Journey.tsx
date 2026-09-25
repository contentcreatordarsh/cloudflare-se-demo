import { ArrowRight, Ban, CircleCheck, CircleX, Cloud, CreditCard, Gauge, Laptop, LockKeyhole, Search, Server, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { ago, coloCity, coloCountry, fmtMs, httpLabel, isPostQuantum, tlsLabel } from "../lib/format";
import { navigate } from "../lib/router";
import { useStore, verdictOf, type Journey } from "../lib/store";
import { Dot, Flag, LiveTag, SectionHead, StatusCode } from "./ui";

const coloOf = (ray: string | null) => (ray && ray.includes("-") ? ray.split("-").pop()!.toUpperCase() : null);

type NodeState = "pass" | "block" | "skip" | "idle";
interface JNode { key: string; name: string; icon: ComponentType<{ className?: string }>; sub: string; metric: string; state: NodeState; tone: string }

export function journeyNodes(j: Journey | null): JNode[] {
  const blocked = j?.blockedAt ?? null;
  const colo = j ? coloOf(j.ray) ?? j.edge?.colo ?? null : null;
  const o = j?.origin ?? null;
  const idle = !j;
  const st = (s: NodeState): NodeState => (idle ? "idle" : s);
  return [
    { key: "browser", name: "Browser", icon: Laptop, tone: "accent", sub: j?.edge?.loc || "—", metric: fmtMs(j?.edge?.ms), state: st("pass") },
    { key: "edge", name: "Cloudflare Edge", icon: Cloud, tone: "edge", sub: colo ? `${coloCity(colo)} (${colo})` : "—", metric: j?.edge ? `${httpLabel(j.edge.http)}` : "—", state: st("pass") },
    { key: "waf", name: "WAF", icon: blocked === "waf" ? ShieldX : ShieldCheck, tone: "ok", sub: blocked === "waf" ? "Blocked" : "Passed", metric: blocked === "waf" ? "403" : "inline", state: st(blocked === "waf" ? "block" : "pass") },
    { key: "rl", name: "Rate Limit", icon: Gauge, tone: "ok", sub: blocked === "ratelimit" ? "Blocked" : blocked ? "Not reached" : "Passed", metric: blocked === "ratelimit" ? "429" : blocked ? "—" : "inline", state: st(blocked === "ratelimit" ? "block" : blocked ? "skip" : "pass") },
    { key: "tls", name: "TLS", icon: LockKeyhole, tone: "violet", sub: blocked ? "Not reached" : tlsLabel(o?.originTls.protocol) , metric: blocked ? "—" : "Full (strict)", state: st(blocked ? "skip" : "pass") },
    { key: "aws", name: "AWS Origin", icon: Server, tone: "aws", sub: "ap-southeast-1", metric: blocked ? "not reached" : fmtMs(j?.originMs), state: st(blocked ? "skip" : "pass") },
    { key: "app", name: "SiamPay App", icon: CreditCard, tone: "accent", sub: blocked ? "Not reached" : j ? `${j.status} ${j.status < 400 ? "OK" : "Error"}` : "—", metric: blocked ? "—" : fmtMs(o?.appMs ?? (j?.source === "log" ? j.totalMs : null)), state: st(blocked ? "skip" : "pass") },
  ];
}

const TONES: Record<string, string> = {
  accent: "border-accent/45 bg-accent/12 text-accent-soft shadow-[0_0_22px_-6px_rgb(47_124_246/0.8)]",
  edge: "border-edge/50 bg-edge/12 text-edge shadow-[0_0_22px_-6px_rgb(246_130_31/0.8)]",
  ok: "border-ok/45 bg-ok/10 text-[#4ade80] shadow-[0_0_22px_-6px_rgb(34_197_94/0.7)]",
  violet: "border-violet/50 bg-violet/12 text-[#a78bfa] shadow-[0_0_22px_-6px_rgb(139_92_246/0.8)]",
  aws: "border-aws/60 bg-aws/10 text-aws shadow-[0_0_22px_-6px_rgb(255_153_0/0.7)]",
};

function JourneyRow({ j, running }: { j: Journey | null; running: boolean }) {
  const nodes = journeyNodes(j);
  return (
    <div className="grid grid-cols-7 items-start gap-0" key={j?.at ?? "idle"}>
      {nodes.map((n, i) => {
        const cls = n.state === "block" ? "border-bad/60 bg-bad/12 text-[#f87171] shadow-[0_0_24px_-6px_rgb(239_68_68/0.8)]"
          : n.state === "skip" || n.state === "idle" ? "border-line-strong bg-ink-750 text-dim"
          : TONES[n.tone];
        const next = nodes[i + 1];
        const flowing = !!next && next.state !== "skip" && next.state !== "idle" && n.state === "pass";
        return (
          <div key={n.key} className="relative flex flex-col items-center text-center">
            {i < nodes.length - 1 && (
              <div className="absolute top-[21px] left-[calc(50%+26px)] h-px w-[calc(100%-52px)]" aria-hidden>
                <div className={`h-px w-full ${flowing ? "bg-gradient-to-r from-accent/70 to-cyan/70" : n.state === "block" ? "bg-bad/40" : "bg-line-strong"}`} />
                <ArrowRight className={`absolute -top-[5.5px] -right-1 size-3 ${flowing ? "text-cyan" : "text-line-strong"}`} />
                {flowing && !running && (
                  <span className="absolute -top-[2.5px] left-0 size-1.5 rounded-full bg-cyan shadow-[0_0_8px_2px_rgb(34_211_238/0.8)]"
                    style={{ animation: `packet 0.5s ease-in-out ${i * 0.32}s both` }} />
                )}
              </div>
            )}
            <span className={`relative z-10 grid size-[42px] place-items-center rounded-full border transition ${cls} ${running ? "animate-pulse" : ""}`}>
              <n.icon className="size-[19px]" />
            </span>
            <span className="mt-2 text-[12px] font-semibold leading-tight">{n.name}</span>
            <span className={`mt-0.5 max-w-full truncate px-1 text-[11px] ${n.state === "block" ? "font-semibold text-[#f87171]" : n.state === "pass" && ["waf", "rl"].includes(n.key) ? "text-[#4ade80]" : "text-muted"}`}>{n.sub}</span>
            <span className="text-[11px] text-dim num">{n.metric}</span>
          </div>
        );
      })}
    </div>
  );
}

function Check({ ok, label, value, tone }: { ok: boolean | null; label: string; value: string; tone?: "bad" | "warn" }) {
  return (
    <div className="flex items-center gap-2 py-[1.5px] text-[12px]">
      {ok === null ? <span className="size-3.5 rounded-full border border-line-strong" /> : ok ? <CircleCheck className="size-3.5 text-ok" /> : <CircleX className="size-3.5 text-bad" />}
      <span className="flex-1 text-muted">{label}</span>
      <span className={`font-medium ${tone === "bad" ? "text-[#f87171]" : tone === "warn" ? "text-[#fcd34d]" : ok ? "text-[#86efac]" : "text-muted"}`}>{value}</span>
    </div>
  );
}

function Line({ k, v, tone, mono = false }: { k: string; v: ReactNode; tone?: "ok" | "bad" | "warn" | "dim"; mono?: boolean }) {
  const t = tone === "ok" ? "text-[#86efac]" : tone === "bad" ? "text-[#f87171]" : tone === "warn" ? "text-[#fcd34d]" : tone === "dim" ? "text-dim" : "text-fg";
  return (
    <div className="flex items-center justify-between gap-2 py-[2px] text-[11.5px] leading-tight">
      <span className="shrink-0 text-muted">{k}</span>
      <span className={`min-w-0 truncate text-right font-medium ${mono ? "font-mono text-[11px]" : ""} ${t}`}>{v}</span>
    </div>
  );
}

function Details({ j }: { j: Journey | null }) {
  const { status } = useStore();
  const colo = j ? coloOf(j.ray) ?? j.edge?.colo ?? null : null;
  const o = j?.origin ?? null;
  const blocked = j?.blockedAt ?? null;
  const cert = status?.originCert;
  const country = j?.edge?.loc || o?.country || null;
  const box = "panel min-w-0 px-3 py-2";
  const head = "mb-1 flex items-center justify-between text-[12px] font-semibold";
  const failed = !!j && !blocked && j.status >= 400;
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <div className={box}>
        <div className={head}>Edge Location</div>
        <div className="flex items-center gap-2 pb-0.5 text-[12.5px] font-semibold"><Flag cc={coloCountry(colo)} />{colo ? `${coloCity(colo)} (${colo})` : "—"}</div>
        <Line k="Network" v="Cloudflare Edge" />
        <Line k="Egress IP" v={o?.edgeIp ?? "—"} mono />
        <button onClick={() => navigate("/inspector")} className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-soft hover:underline">View Details <ArrowRight className="size-3" /></button>
      </div>
      <div className={box}>
        <div className={head}>Security Checks</div>
        <Check ok={j ? blocked !== "waf" : null} label="WAF" value={!j ? "—" : blocked === "waf" ? "Blocked · 403" : "Passed"} tone={blocked === "waf" ? "bad" : undefined} />
        <Check ok={j ? blocked !== "ratelimit" : null} label="Rate Limiting" value={!j ? "—" : blocked === "ratelimit" ? `Blocked · #${j.attempts?.length ?? "?"}` : blocked ? "Not reached" : "Passed"} tone={blocked === "ratelimit" ? "warn" : undefined} />
        <Check ok={j ? true : null} label="Bot challenge" value={j ? "None" : "—"} />
        <Check ok={j ? true : null} label="Country" value={country ? `Allowed (${country})` : "—"} />
      </div>
      <div className={box}>
        <div className={head}>TLS Information <LockKeyhole className="size-3.5 text-[#a78bfa]" /></div>
        <Line k="Client → Edge" v={j?.edge ? `${tlsLabel(j.edge.tls)}${isPostQuantum(j.edge.kex) ? " · PQ" : ""}` : "—"} tone={j?.edge ? "ok" : undefined} />
        <Line k="Edge → Origin" v={blocked ? "Not reached" : o ? `${tlsLabel(o.originTls.protocol)} · strict` : "—"} tone={blocked ? "dim" : o ? "ok" : undefined} />
        <Line k="Certificate" v={cert ? `${cert.issuerOrg} ✓` : "—"} tone={cert && cert.daysLeft > 0 ? "ok" : undefined} />
        <Line k="Encryption" v={blocked ? "Edge only" : o ? "End-to-end" : "—"} />
      </div>
      <div className={box}>
        <div className={head}>Origin Response <span className="font-normal text-muted">AWS EC2</span></div>
        {blocked ? (
          <>
            <div className="flex items-center gap-1.5 py-[2px] text-[11.5px] font-semibold text-[#86efac]"><Ban className="size-3.5" />Never reached AWS</div>
            <Line k="Answered by" v={`Cloudflare · ${j?.status}`} />
            <Line k="Origin" v="Protected" tone="ok" />
            <Line k="Region" v="ap-southeast-1" />
          </>
        ) : (
          <>
            <Line k="Status" v={j ? `${j.status}${j.status < 400 ? " OK" : ""}` : "—"} tone={failed ? "warn" : j ? "ok" : undefined} mono />
            <Line k="Response time" v={fmtMs(j?.originMs != null && o ? j.originMs + o.appMs : j?.source === "log" ? j.totalMs : null)} mono />
            <Line k="Origin IP" v={o?.originIp ?? "—"} mono />
            <Line k="Region" v="ap-southeast-1" />
          </>
        )}
      </div>
    </div>
  );
}

export function JourneyPanel() {
  const { journey: j, running } = useStore();
  const pill = running ? { t: "Tracing…", tone: "dim" as const }
    : !j ? { t: "Waiting for a request", tone: "dim" as const }
    : j.blockedAt === "waf" ? { t: "Blocked by WAF", tone: "bad" as const }
    : j.blockedAt === "ratelimit" ? { t: "Rate limited at edge", tone: "warn" as const }
    : j.status >= 400 ? { t: `Request failed (${j.status})`, tone: "warn" as const }
    : { t: "Request Completed", tone: "ok" as const };
  return (
    <div className="panel flex min-w-0 flex-col gap-2.5 p-3">
      <SectionHead n={2} title="Request Journey" sub="Live view of how your request travels through Cloudflare to AWS."
        right={
          <div className="flex items-center gap-3 text-[11.5px]">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${pill.tone === "ok" ? "text-[#4ade80]" : pill.tone === "bad" ? "text-[#f87171]" : pill.tone === "warn" ? "text-[#fcd34d]" : "text-muted"}`}><Dot tone={pill.tone} pulse={pill.tone === "ok"} />{pill.t}</span>
            <span className="text-muted">Total Time: <span className="font-mono text-fg num">{j ? fmtMs(j.totalMs) : "—"}</span></span>
            {j?.source === "live" && <LiveTag />}
          </div>
        } />
      <JourneyRow j={j} running={!!running} />
      <Details j={j} />
    </div>
  );
}

export function TracePanel() {
  const { journey, events, logs, runExample, running, showJourney } = useStore();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const booted = useRef(false);

  useEffect(() => { // first visit: trace one real request so the console opens on live data
    if (booted.current || journey) return;
    booted.current = true;
    runExample("normal");
  }, [journey, runExample]);
  useEffect(() => { if (journey?.ray) setQ(`cf-ray ${journey.ray}`); }, [journey?.ray]);

  const recent = useMemo(() => {
    const seen = new Set<string>();
    const rows = [
      ...events.map((e) => ({ ray: e.ray, path: e.path, status: e.status, t: e.t, country: e.country, ms: e.ms, src: "edge" as const })),
      ...logs.filter((l) => l.path !== "/" && !l.path.startsWith("/assets")).map((l) => ({ ray: l.ray, path: l.path, status: l.status, t: l.t, country: l.country, ms: l.ms, src: "origin" as const })),
    ].sort((a, b) => b.t.localeCompare(a.t));
    return rows.filter((r) => r.ray && !seen.has(r.ray) && seen.add(r.ray)).slice(0, 3);
  }, [events, logs]);

  const load = (ray: string) => {
    const term = ray.replace(/^cf-ray\s*/i, "").trim().toLowerCase();
    const ev = events.find((e) => e.ray?.toLowerCase().includes(term));
    const lg = logs.find((l) => l.ray?.toLowerCase().includes(term));
    if (journey?.ray?.toLowerCase().includes(term)) { setMsg(null); return; }
    const hit = ev ?? lg;
    if (!hit) { setMsg("Not found. Blocked requests never reach the origin log — pick a recent request below."); return; }
    setMsg(null);
    const v = verdictOf(hit.status);
    showJourney({
      kind: v === "blocked_waf" ? "waf" : v === "rate_limited" ? "ratelimit" : "normal",
      at: hit.t, path: hit.path, status: hit.status, ray: hit.ray, totalMs: hit.ms, edge: null, origin: null,
      blockedAt: v === "blocked_waf" ? "waf" : v === "rate_limited" ? "ratelimit" : null, originMs: null, source: "log",
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.replace(/^cf-ray\s*/i, "").trim();
    if (!term || term === journey?.ray) runExample("normal");
    else load(term);
  };

  return (
    <div className="panel flex min-w-0 flex-col gap-2 p-3">
      <SectionHead n={1} title="Trace a Request" sub="Enter a Ray ID or send a test request to see the full journey." />
      <form onSubmit={submit} className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="cf-ray a40a45cd1de54422-SIN" aria-label="Ray ID"
            className="h-9 w-full rounded-lg border border-line-strong bg-ink-850 pr-2 pl-8 font-mono text-[12px] text-fg placeholder:text-dim focus:border-accent/60 focus:outline-none" />
        </label>
        <button className="btn-primary" disabled={!!running}>{running ? "Tracing…" : "Trace Request"}</button>
      </form>
      {msg && <p className="text-[11.5px] text-[#fcd34d]">{msg}</p>}
      <div>
        <div className="mb-1 text-[12px] font-semibold">Recent Requests</div>
        <ul className="divide-y divide-line">
          {recent.length === 0 && <li className="py-3 text-[12px] text-dim">No requests yet — run an example.</li>}
          {recent.map((r) => (
            <li key={r.ray!}>
              <button onClick={() => load(r.ray!)} className="flex w-full items-center gap-2.5 py-1 text-left hover:bg-white/[0.02]">
                <Flag cc={r.country} className="h-3.5 w-5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11.5px] text-fg">{r.ray}</span>
                  <span className="block truncate text-[11px] text-dim">{ago(r.t)} · {r.src === "edge" ? "this browser" : "origin log"}</span>
                </span>
                <span className="hidden w-[92px] truncate font-mono text-[11px] text-muted sm:block" title={r.path}>{r.path.split("?")[0]}</span>
                <StatusCode code={r.status} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
