import { ArrowRight, Building2, CircleCheck, Cloud, ExternalLink, KeyRound, LockKeyhole, RefreshCw, UserRound } from "lucide-react";
import { useState } from "react";
import { PORTAL_URL } from "../lib/api";
import { useStore } from "../lib/store";
import { Kv, LiveTag, Logo } from "./ui";

function Step({ icon: Icon, name, sub, tone }: { icon: typeof UserRound; name: string; sub: string; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <span className={`grid size-11 place-items-center rounded-xl border ${tone}`}><Icon className="size-5" /></span>
      <span className="mt-1.5 text-[12px] font-semibold">{name}</span>
      <span className="text-[11px] text-muted">{sub}</span>
    </div>
  );
}
const Arrow = () => <ArrowRight className="mt-3.5 size-4 shrink-0 text-accent-soft" />;

export function StaffView() {
  const { identity, refreshIdentity, status } = useStore();
  const [checking, setChecking] = useState(false);
  const tunnel = status?.tunnel;
  const check = async () => { setChecking(true); await refreshIdentity(); setChecking(false); };
  const expiresIn = identity ? Math.max(0, Math.round((new Date(identity.expiresAt).getTime() - Date.now()) / 3600000)) : null;
  const role = identity ? (identity.email.endsWith("@cloudflare.com") ? "Cloudflare reviewer (@cloudflare.com)" : "Owner (allow-listed email)") : "—";

  return (
    <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr_1fr]">
      <div className="panel flex flex-col gap-3 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <div><div className="text-[14px] font-semibold">NOVA Staff Portal</div><div className="text-[12px] text-muted">Sign in with your company account</div></div>
          </div>
          <LiveTag />
        </div>
        <div className="flex items-start justify-between gap-1 rounded-lg border border-line bg-ink-850 px-2 py-3">
          <Step icon={UserRound} name="Employee" sub="any network" tone="border-accent/45 bg-accent/10 text-accent-soft" />
          <Arrow />
          <Step icon={LockKeyhole} name="Access" sub="identity check" tone="border-edge/50 bg-edge/10 text-edge" />
          <Arrow />
          <Step icon={Cloud} name="Tunnel" sub="outbound only" tone="border-violet/50 bg-violet/10 text-[#a78bfa]" />
          <Arrow />
          <Step icon={Building2} name="Staff app" sub="EC2 · private" tone="border-aws/55 bg-aws/10 text-aws" />
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={PORTAL_URL} target="_blank" rel="noopener"><KeyRound className="size-4" />Sign in with Cloudflare Access<ExternalLink className="size-3.5 opacity-70" /></a>
          <button className="btn-ghost" onClick={check} disabled={checking}><RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} />Check session</button>
        </div>
      </div>

      <div className="panel p-3.5">
        <div className="mb-2 text-[13px] font-semibold">Zero Trust controls</div>
        <ul className="space-y-2 text-[12.5px]">
          {[
            ["Identity-aware access", "Allow: owner + any @cloudflare.com email"],
            ["No inbound ports", "EC2 exposes nothing for this app"],
            ["Protected by Cloudflare Tunnel", tunnel ? `${tunnel.ready} live connections from cloudflared` : "checking…"],
            ["Audit logs enabled", "Zero Trust → Logs → Access"],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" /><span><span className="block font-medium">{t}</span><span className="block text-[11.5px] text-muted">{d}</span></span></li>
          ))}
        </ul>
      </div>

      <div className="panel p-3.5">
        <div className="mb-1 flex items-center justify-between text-[13px] font-semibold">Staff identity {identity && <span className="live-tag">Verified</span>}</div>
        {identity ? (
          <>
            <Kv k="User" v={identity.email} />
            <Kv k="Role" v={role} />
            <Kv k="Identity" v="Verified · Access JWT" tone="ok" />
            <Kv k="Login method" v="One-time PIN (email)" />
            <Kv k="Session" v={`since ${new Date(identity.authenticatedAt).toISOString().slice(11, 16)} UTC · ${expiresIn}h left`} />
            <Kv k="Device posture" v="Not evaluated" />
          </>
        ) : (
          <div className="mt-2 space-y-2 text-[12.5px] text-muted">
            <p>{identity === undefined ? "Checking for an Access session…" : "No Access session in this browser yet."}</p>
            <p className="text-[11.5px] text-dim">Sign in (opens the real Access login for <span className="font-mono">tunnel.strikemap.space/secure</span>), then press <span className="text-fg">Check session</span> — the Worker returns the identity from the verified Access JWT.</p>
          </div>
        )}
      </div>
    </div>
  );
}
