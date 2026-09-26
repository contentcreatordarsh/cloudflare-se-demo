import { ArrowRight, Ban, ChartCandlestick, CircleCheck, CircleX, Cloud, Gauge, Laptop, LockKeyhole, Search, Server, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { ago, coloCity, fmtMs, httpLabel, tlsLabel } from "../lib/format";
import { navigate } from "../lib/router";
import { useStore, verdictOf, type Journey } from "../lib/store";
import { Dot, Flag, SectionHead, StatusCode } from "./ui";

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
    { key: "app", name: "NOVA App", icon: ChartCandlestick, tone: "accent", sub: blocked ? "Not reached" : j ? `${j.status} ${j.status < 400 ? "OK" : "Error"}` : "—", metric: blocked ? "—" : fmtMs(o?.appMs ?? (j?.source === "log" ? j.totalMs : null)), state: st(blocked ? "skip" : "pass") },
  ];
}

const TONES: Record<string, string> = {
  accent: "border-accent/50 bg-accent/12 text-accent-soft shadow-[0_0_20px_-6px_rgb(47_128_237/0.85)]",
  edge: "border-brand/60 bg-brand/15 text-brand shadow-[0_0_22px_-5px_rgb(246_130_31/0.9)]",
  ok: "border-ok/50 bg-ok/10 text-ok shadow-[0_0_20px_-6px_rgb(0_208_132/0.7)]",
  violet: "border-violet/55 bg-violet/12 text-[#a78bfa] shadow-[0_0_20px_-6px_rgb(139_92_246/0.85)]",
  aws: "border-aws/60 bg-aws/10 text-aws shadow-[0_0_20px_-6px_rgb(255_153_0/0.75)]",
};

function JourneyRow({ j, running }: { j: Journey | null; running: boolean }) {
  const nodes = journeyNodes(j);
  const { setTab } = useStore();
  // Clicking a node opens the panel that demonstrates that control.
  const open = (key: string) => {
    if (key === "browser" || key === "edge") navigate("/inspector");
    else if (key === "waf") navigate("/security");
    else if (key === "rl") setTab("ratelimit");
    else if (key === "tls") setTab("tls");
    else if (key === "aws") navigate("/", { hash: "resiliency" });
    else setTab("logs");
  };
  return (
    <div className="grid grid-cols-7 items-start gap-0" key={j?.at ?? "idle"}>
      {nodes.map((n, i) => {
        const cls = n.state === "block" ? "border-bad/60 bg-bad/12 text-bad shadow-[0_0_24px_-6px_rgb(255_77_90/0.8)]"
          : n.state === "skip" || n.state === "idle" ? "border-line-strong bg-ink-750 text-dim"
          : TONES[n.tone];
        const next = nodes[i + 1];
        const flowing = !!next && next.state !== "skip" && next.state !== "idle" && n.state === "pass";
        return (
          <button type="button" key={n.key} onClick={() => open(n.key)} title={`Open the ${n.name} demo`} className="group relative flex flex-col items-center rounded-md text-center">
            {i < nodes.length - 1 && (
              <div className="absolute top-[18px] left-[calc(50%+22px)] h-px w-[calc(100%-44px)]" aria-hidden>
                <div className={`h-px w-full ${flowing ? "bg-gradient-to-r from-brand/70 to-brand-soft/70" : n.state === "block" ? "bg-bad/40" : "bg-line-strong"}`} />
                <ArrowRight className={`absolute -top-[5.5px] -right-1 size-3 ${flowing ? "text-brand-soft" : "text-line-strong"}`} />
                {flowing && !running && (
                  <span className="absolute -top-[2.5px] left-0 size-1.5 rounded-full bg-brand-soft shadow-[0_0_8px_2px_rgb(246_130_31/0.8)]"
                    style={{ animation: `packet 0.5s ease-in-out ${i * 0.32}s both` }} />
                )}
              </div>
            )}
            <span className={`relative z-10 grid size-[38px] place-items-center rounded-full border transition group-hover:scale-110 ${cls} ${running ? "animate-pulse" : ""}`}>
              <n.icon className="size-[17px]" />
            </span>
            <span className="mt-1.5 max-w-[78px] text-[11.5px] leading-tight font-semibold">{n.name}</span>
            <span className={`mt-0.5 max-w-full truncate px-0.5 text-[10.5px] ${n.state === "block" ? "font-semibold text-bad" : n.state === "pass" && ["waf", "rl"].includes(n.key) ? "text-ok" : n.key === "edge" && n.state === "pass" ? "text-brand-soft" : "text-muted"}`}>{n.sub}</span>
            <span className="text-[10.5px] text-dim num">{n.metric}</span>
          </button>
        );
      })}
    </div>
  );
}

function Check({ ok, label, value, tone }: { ok: boolean | null; label: string; value: string; tone?: "bad" | "warn" }) {
  return (
    <div className="flex items-center gap-1.5 py-px text-[11px] whitespace-nowrap">
      {ok === null ? <span className="size-3.5 rounded-full border border-line-strong" /> : ok ? <CircleCheck className="size-3.5 text-ok" /> : <CircleX className="size-3.5 text-bad" />}
      <span className="min-w-0 flex-1 truncate text-muted">{label}</span>
      <span className={`font-medium ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : ok ? "text-[#5ff0b0]" : "text-muted"}`}>{value}</span>
    </div>
  );
}

function Line({ k, v, tone, mono = false }: { k: string; v: ReactNode; tone?: "ok" | "bad" | "warn" | "dim"; mono?: boolean }) {
  const t = tone === "ok" ? "text-[#5ff0b0]" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "dim" ? "text-dim" : "text-fg";
  return (
    <div className="flex items-center justify-between gap-2 py-px text-[11px] leading-tight whitespace-nowrap">
      <span className="shrink-0 text-muted">{k}</span>
      <span className={`min-w-0 truncate text-right font-medium ${mono ? "font-mono text-[11px]" : ""} ${t}`}>{v}</span>
    </div>
  );
}

function Details({ j }: { j: Journey | null }) {
  const colo = j ? coloOf(j.ray) ?? j.edge?.colo ?? null : null;
  const o = j?.origin ?? null;
  const blocked = j?.blockedAt ?? null;
  const country = j?.edge?.loc || o?.country || null;
  const box = "panel min-w-0 px-3 py-2";
  const head = "mb-1 flex items-center justify-between gap-1 text-[11.5px] font-semibold whitespace-nowrap";
  const failed = !!j && !blocked && j.status >= 400;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className={box}>
        <div className={head}>Request Details <button onClick={() => navigate("/inspector")} className="text-brand hover:text-brand-soft" aria-label="Open in Request Inspector" title="Open in Request Inspector"><ArrowRight className="size-3.5" /></button></div>
        <Line k="Ray ID" v={j?.ray ?? "—"} mono />
        <Line k="Country" v={country ? <span className="inline-flex items-center gap-1.5"><Flag cc={country} className="h-3 w-4" />{country}</span> : "—"} />
        <Line k="Edge" v={colo ? `${coloCity(colo)} (${colo})` : "—"} />
        <Line k="Method · Path" v={j ? `GET ${j.path.split("?")[0]}` : "—"} mono />
      </div>
      <div className={box}>
        <div className={head}>Security Checks</div>
        <Check ok={j ? blocked !== "waf" : null} label="WAF" value={!j ? "—" : blocked === "waf" ? "Blocked · 403" : "Passed"} tone={blocked === "waf" ? "bad" : undefined} />
        <Check ok={j ? blocked !== "ratelimit" : null} label="Rate Limiting" value={!j ? "—" : blocked === "ratelimit" ? `Blocked · #${j.attempts?.length ?? "?"}` : blocked ? "Skipped" : "Passed"} tone={blocked === "ratelimit" ? "warn" : undefined} />
        <Check ok={j ? true : null} label="Bot challenge" value={j ? "None" : "—"} />
        <Check ok={j ? true : null} label="Country" value={country ? `Allowed (${country})` : "—"} />
      </div>
      <div className={box}>
        <div className={head}>Origin Response <span className="font-normal text-dim">EC2</span></div>
        {blocked ? (
          <>
            <div className="flex items-center gap-1.5 py-[2px] text-[11.5px] font-semibold text-ok"><Ban className="size-3.5" />Never reached AWS</div>
            <Line k="Answered by" v={`Cloudflare · ${j?.status}`} />
            <Line k="Origin" v="Protected" tone="ok" />
            <Line k="AWS Region" v="ap-southeast-1" />
          </>
        ) : (
          <>
            <Line k="Status Code" v={j ? `${j.status}${j.status < 400 ? " OK" : ""}` : "—"} tone={failed ? "warn" : j ? "ok" : undefined} mono />
            <Line k="Response Time" v={fmtMs(j?.originMs != null && o ? j.originMs + o.appMs : j?.source === "log" ? j.totalMs : null)} mono />
            <Line k="Origin IP" v={o?.originIp ?? "—"} mono />
            <Line k="AWS Region" v="ap-southeast-1" />
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
      <SectionHead n={2} title="Request Journey" sub="Live view of your request through Cloudflare to AWS."
        right={
          <div className="flex flex-col items-end gap-0.5 text-[11.5px]">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${pill.tone === "ok" ? "text-ok" : pill.tone === "bad" ? "text-bad" : pill.tone === "warn" ? "text-warn" : "text-muted"}`}><Dot tone={pill.tone} pulse={pill.tone === "ok"} />{pill.t}</span>
            <span className="whitespace-nowrap text-muted">Total Time: <span className="font-mono text-fg num">{j ? fmtMs(j.totalMs) : "—"}</span></span>
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
      <SectionHead n={1} title="Trace a Request" sub="Enter a Ray ID or send a test request." />
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label className="relative min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="cf-ray a40a45cd1de54422-SIN" aria-label="Ray ID"
            className="h-9 w-full rounded-lg border border-line-strong bg-ink-850 pr-2 pl-8 font-mono text-[12px] text-fg placeholder:text-dim focus:border-accent/60 focus:outline-none" />
        </label>
        <button className="btn-primary h-8" disabled={!!running}>{running ? "Tracing…" : "Trace Request"}</button>
      </form>
      {msg && <p className="text-[11.5px] text-warn">{msg}</p>}
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
                <span className="hidden w-[58px] truncate font-mono text-[10.5px] text-muted sm:block" title={r.path}>{r.path.split("?")[0]}</span>
                <StatusCode code={r.status} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
