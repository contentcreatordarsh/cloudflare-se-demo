import { ArrowRight, CircleCheck, Cloud, Laptop, LockKeyhole, Server, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { timed, type OriginTrace } from "../lib/api";
import { isPostQuantum, tlsLabel } from "../lib/format";
import { useStore } from "../lib/store";
import { Dot, Kv, LiveTag } from "./ui";

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function Hop({ icon: Icon, name, sub, tone }: { icon: typeof Laptop; name: string; sub: string; tone: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className={`grid size-12 place-items-center rounded-xl border ${tone}`}><Icon className="size-5" /></span>
      <span className="mt-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase">{name}</span>
      <span className="text-[11px] text-muted">{sub}</span>
    </div>
  );
}

function Link({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center px-1 pt-3">
      <span className="flex items-center gap-1 rounded-md border border-violet/35 bg-violet/10 px-2 py-0.5 text-[11px] font-semibold text-[#c4b5fd]"><LockKeyhole className="size-3" />{label}</span>
      <div className="relative my-1.5 h-px w-full bg-gradient-to-r from-violet/30 via-violet/70 to-violet/30">
        <ArrowRight className="absolute -top-[5.5px] -right-1 size-3 text-[#a78bfa]" />
      </div>
      <span className="truncate text-[10.5px] text-dim">{sub}</span>
    </div>
  );
}

export function TlsView({ full = false }: { full?: boolean }) {
  const { status, edge, journey } = useStore();
  const c = status?.originCert;
  const e = status?.edgeCert;
  const [probe, setProbe] = useState<OriginTrace | null>(null);
  useEffect(() => { // measure the Cloudflare -> origin TLS session directly if no trace has run yet
    if (journey?.origin) return;
    let alive = true;
    timed<OriginTrace>(`/api/trace?ts=${Date.now()}`).then((r) => { if (alive) setProbe(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [journey?.origin]);
  const originTls = (journey?.origin ?? probe)?.originTls.protocol ?? null;
  const cipher = (journey?.origin ?? probe)?.originTls.cipher ?? null;
  const pq = isPostQuantum(edge?.kex);
  const life = c ? Math.max(0, Math.min(100, (c.daysLeft / c.totalDays) * 100)) : 0;

  return (
    <div className={`grid gap-3 ${full ? "xl:grid-cols-[1.35fr_1fr]" : "lg:grid-cols-[1.35fr_0.85fr_1fr]"}`}>
      <div className="panel p-3.5">
        <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold">Encryption path</span><LiveTag /></div>
        <div className="flex items-start">
          <Hop icon={Laptop} name="Browser" sub={edge?.loc ?? "—"} tone="border-accent/45 bg-accent/10 text-accent-soft" />
          <Link label={edge ? `${tlsLabel(edge.tls)}${pq ? " · PQ" : ""}` : "—"} sub={edge ? `${edge.http.toUpperCase()} · ${edge.kex}` : "edge trace pending"} />
          <Hop icon={Cloud} name="Cloudflare" sub={edge?.colo ?? "—"} tone="border-edge/50 bg-edge/10 text-edge" />
          <Link label={originTls ? tlsLabel(originTls) : "—"} sub={cipher ?? "Full (strict) · validated"} />
          <Hop icon={Server} name="AWS Origin" sub="ap-southeast-1" tone="border-aws/55 bg-aws/10 text-aws" />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Traffic is encrypted on <span className="text-fg">both</span> hops. In Full (strict) mode Cloudflare only connects to the origin if its
          certificate is issued by a trusted CA, matches <span className="font-mono text-fg">app.strikemap.space</span> and is unexpired — so a
          hijacked or self-signed origin is refused (HTTP 526) instead of silently trusted.
          {pq && <> This browser also negotiated <span className="text-fg">post-quantum key agreement</span> ({edge?.kex}) with the edge.</>}
        </p>
      </div>

      <div className="panel flex flex-col justify-center p-3.5">
        <div className="label">SSL/TLS Mode</div>
        <div className="mt-1 text-[24px] font-bold tracking-tight">FULL (STRICT)</div>
        <div className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ok"><Dot pulse />Enabled</div>
        <ul className="mt-3 space-y-1.5 text-[12px] text-muted">
          {["Trusted CA required", "Hostname must match", "Expired certs refused", "Minimum TLS 1.2 · Always Use HTTPS"].map((t) => (
            <li key={t} className="flex items-center gap-2"><CircleCheck className="size-3.5 text-ok" />{t}</li>
          ))}
        </ul>
      </div>

      <div className="panel p-3.5">
        <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold"><ShieldCheck className="size-4 text-ok" />Origin certificate</div>
        <Kv k="Certificate Authority" v={c ? `${c.issuerOrg} · ${c.issuerCN}` : "—"} />
        <Kv k="Status" v={c ? `Valid · ${c.daysLeft} days left` : "—"} tone={c && c.daysLeft > 7 ? "ok" : "warn"} />
        <Kv k="Protocol" v={originTls ? tlsLabel(originTls) : "—"} />
        <Kv k="Encryption" v="End-to-end" tone="ok" />
        <Kv k="Key" v={c?.key ?? "—"} />
        <Kv k="Edge certificate" v={e ? `${e.issuerOrg} · ${e.issuerCN}` : "—"} />
        {full && c && (
          <div className="mt-2 border-t border-line pt-2">
            <Kv k="Subject" v={c.subject} mono />
            <Kv k="SANs" v={c.san.join(", ")} mono />
            <Kv k="Valid" v={`${fmtDate(c.validFrom)} → ${fmtDate(c.validTo)}`} />
            <div className="my-1 h-1.5 overflow-hidden rounded-full bg-line-strong"><div className="h-full rounded-full bg-gradient-to-r from-cyan to-ok" style={{ width: `${life}%` }} /></div>
            <Kv k="Serial" v={c.serial} mono />
            <div className="py-1 text-[12px] text-muted">SHA-256 fingerprint</div>
            <div className="font-mono text-[11px] break-all text-fg">{c.fingerprint}</div>
            <div className="mt-2 text-[11.5px] text-dim">Issued via ACME DNS-01 on Cloudflare DNS — no inbound port 80 needed.</div>
          </div>
        )}
      </div>
    </div>
  );
}
