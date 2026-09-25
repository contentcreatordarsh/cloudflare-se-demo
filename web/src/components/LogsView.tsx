import { Filter, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { timeOf } from "../lib/format";
import { useStore, verdictOf, type Verdict } from "../lib/store";
import { Flag, LiveTag, StatusCode } from "./ui";

interface Row { key: string; t: string; source: "Edge" | "Origin"; country: string | null; method: string; path: string; status: number; verdict: Verdict; colo: string | null; ray: string | null; ms: number }

const ACTION: Record<Verdict, { label: string; cls: string }> = {
  allowed: { label: "Allowed", cls: "text-[#5ff0b0]" },
  blocked_waf: { label: "Blocked (WAF)", cls: "text-bad" },
  rate_limited: { label: "Rate limited", cls: "text-warn" },
  error: { label: "Error", cls: "text-muted" },
};

const sel = "h-8 rounded-md border border-line-strong bg-ink-850 px-2 text-[12px] text-fg focus:outline-none";

export function LogsView({ full = false }: { full?: boolean }) {
  const { logs, events, refreshLogs } = useStore();
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<"all" | Verdict>("all");
  const [endpoint, setEndpoint] = useState("");
  const [ray, setRay] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");

  useEffect(() => {
    const onPop = () => setRay(new URLSearchParams(window.location.search).get("q") ?? "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const rows = useMemo<Row[]>(() => {
    const originRows: Row[] = logs.map((l, i) => ({ key: `o${i}-${l.t}`, t: l.t, source: "Origin", country: l.country, method: l.method, path: l.path, status: l.status, verdict: verdictOf(l.status), colo: l.colo, ray: l.ray, ms: l.ms }));
    const edgeRows: Row[] = events.filter((e) => e.verdict !== "allowed").map((e) => ({ key: e.id, t: e.t, source: "Edge", country: e.country, method: e.method, path: e.path, status: e.status, verdict: e.verdict, colo: e.colo, ray: e.ray, ms: e.ms }));
    return [...originRows, ...edgeRows].sort((a, b) => b.t.localeCompare(a.t));
  }, [logs, events]);

  const countries = useMemo(() => [...new Set(rows.map((r) => r.country).filter(Boolean))] as string[], [rows]);
  const q = ray.trim().toLowerCase();
  const filtered = rows.filter((r) =>
    (country === "all" || r.country === country) &&
    (status === "all" || String(r.status).startsWith(status)) &&
    (action === "all" || r.verdict === action) &&
    (!endpoint || r.path.toLowerCase().includes(endpoint.toLowerCase())) &&
    (!q || r.ray?.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)));

  const perMinute = useMemo(() => {
    const m = new Map<string, { min: string; allowed: number; blocked: number }>();
    for (const r of rows) {
      const k = r.t.slice(11, 16);
      const b = m.get(k) ?? { min: k, allowed: 0, blocked: 0 };
      if (r.verdict === "allowed") b.allowed++; else b.blocked++;
      m.set(k, b);
    }
    return [...m.values()].sort((a, b) => a.min.localeCompare(b.min)).slice(-20);
  }, [rows]);

  return (
    <div className="flex flex-col gap-3">
      {full && (
        <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
          <div className="panel grid grid-cols-2 gap-3 p-3">
            {[
              ["Reached origin", rows.filter((r) => r.source === "Origin").length, "text-[#5ff0b0]"],
              ["Blocked at edge (this browser)", rows.filter((r) => r.source === "Edge").length, "text-bad"],
              ["WAF blocks", rows.filter((r) => r.verdict === "blocked_waf").length, "text-bad"],
              ["Rate limited", rows.filter((r) => r.verdict === "rate_limited").length, "text-warn"],
            ].map(([k, v, c]) => (
              <div key={k as string}><div className="text-[11.5px] text-muted">{k}</div><div className={`text-[22px] font-semibold num ${c}`}>{v}</div></div>
            ))}
          </div>
          <div className="panel p-3">
            <div className="mb-1 flex items-center justify-between text-[12px]"><span className="font-semibold">Requests per minute</span><LiveTag /></div>
            <div className="h-[92px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perMinute} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid stroke="#1c2025" vertical={false} />
                  <XAxis dataKey="min" tick={{ fill: "#62686f", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#62686f", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#101214", border: "1px solid #2a2f36", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="allowed" name="Allowed" stackId="a" fill="#2f80ed" isAnimationActive={false} />
                  <Bar dataKey="blocked" name="Blocked at edge" stackId="a" fill="#ff4d5a" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="panel min-w-0 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-dim" />
          <select className={sel} value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
            <option value="all">Country: all</option>{countries.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">Status: all</option><option value="2">2xx</option><option value="403">403</option><option value="429">429</option><option value="4">4xx</option>
          </select>
          <select className={sel} value={action} onChange={(e) => setAction(e.target.value as "all" | Verdict)} aria-label="Action">
            <option value="all">Action: all</option><option value="allowed">Allowed</option><option value="blocked_waf">Blocked (WAF)</option><option value="rate_limited">Rate limited</option>
          </select>
          <input className={`${sel} w-32`} placeholder="Endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} aria-label="Endpoint" />
          <input className={`${sel} w-44 font-mono`} placeholder="Ray ID" value={ray} onChange={(e) => setRay(e.target.value)} aria-label="Ray ID" />
          <button className="chip ml-auto" onClick={refreshLogs}><RefreshCw className="size-3" />Refresh</button>
        </div>
        <div className={`overflow-auto ${full ? "max-h-[520px]" : "max-h-[196px]"}`}>
          <table className="w-full border-collapse font-mono text-[11.5px]">
            <thead className="sticky top-0 bg-ink-800">
              <tr className="text-left text-[10px] tracking-[0.1em] text-dim uppercase">
                {["Time (UTC)", "Source", "Country", "Method", "Path", "Status", "Action", "Edge", "Ray ID", "Latency"].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={10} className="px-2 py-6 text-center font-sans text-[12px] text-dim">No matching requests.</td></tr>}
              {filtered.slice(0, full ? 200 : 40).map((r) => (
                <tr key={r.key} className="border-t border-line/70 hover:bg-white/[0.02]">
                  <td className="px-2 py-1.5 text-muted num">{timeOf(r.t)}</td>
                  <td className="px-2 py-1.5"><span className={r.source === "Edge" ? "text-edge" : "text-accent-soft"}>{r.source}</span></td>
                  <td className="px-2 py-1.5"><span className="inline-flex items-center gap-1.5"><Flag cc={r.country} />{r.country ?? "—"}</span></td>
                  <td className="px-2 py-1.5 text-muted">{r.method}</td>
                  <td className="max-w-[220px] truncate px-2 py-1.5" title={r.path}>{r.path}</td>
                  <td className="px-2 py-1.5"><StatusCode code={r.status} /></td>
                  <td className={`px-2 py-1.5 font-sans font-medium ${ACTION[r.verdict].cls}`}>{ACTION[r.verdict].label}</td>
                  <td className="px-2 py-1.5 text-muted">{r.colo ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted">{r.ray ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right text-muted num">{r.ms.toFixed(r.ms < 10 ? 1 : 0)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-sans text-[11px] text-dim">
          <span className="text-accent-soft">Origin</span> rows are requests that reached AWS (origin processing time). <span className="text-edge">Edge</span> rows are responses this browser received straight from Cloudflare (round-trip time) — they never appear on the origin.
        </p>
      </div>
    </div>
  );
}
