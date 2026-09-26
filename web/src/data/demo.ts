// Illustrative telemetry for the presentation. Everything in this file is SIMULATED and is
// labelled as such in the UI. Live values (trace, TLS, health, logs, identity) come from lib/api.ts.

// Deterministic pseudo-random so the charts look the same on every load.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function series(seed: number, n: number, base: number, amp: number, trend = 0, spikes: number[] = []) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const wave = Math.sin(i / 2.3) * amp * 0.35 + Math.sin(i / 5.1) * amp * 0.25;
    const noise = (r() - 0.5) * amp * 0.8;
    const spike = spikes.includes(i) ? amp * 1.6 : 0;
    return { i, v: Math.max(0, Math.round(base + wave + noise + trend * i + spike)) };
  });
}

export interface Kpi {
  id: string;
  label: string;
  value: number;
  unit?: string;
  delta: number; // percent vs previous 24h
  color: string;
  data: { i: number; v: number }[];
}

// Spec §14 top KPIs (simulated). Origin Health and Tunnel Status are live and rendered separately.
export const KPIS: Kpi[] = [
  { id: "total", label: "Global Requests", value: 2_400_000, delta: 12, color: "#2f80ed", data: series(7, 24, 520, 90, 4) },
  { id: "blocks", label: "Edge Blocks", value: 184_000, delta: 8, color: "#ff4d5a", data: series(11, 24, 48, 22, 0.8, [17, 21]) },
  { id: "rl", label: "Rate Limited", value: 12_800, delta: -24, color: "#f6821f", data: series(3, 24, 5, 4, -0.08, [9]) },
];

export const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "")}K` : n.toLocaleString("en-US");

export const TRAFFIC_MIX = [
  { key: "allowed", label: "Allowed", pct: 75, color: "#2f80ed" },
  { key: "blocked", label: "Blocked", pct: 15, color: "#ff4d5a" },
  { key: "ratelimited", label: "Rate Limited", pct: 5, color: "#f6821f" },
  { key: "challenged", label: "Challenged", pct: 3, color: "#8b5cf6" },
  { key: "origin", label: "Origin", pct: 2, color: "#00d084" },
] as const;

// Globe traffic sources -> Singapore. DEMO TRAFFIC: typical public-internet RTTs to Singapore, not measured here.
export const SOURCES = [
  { id: "LON", label: "London", city: "London", ll: [-0.13, 51.51] as [number, number], rtt: 155 },
  { id: "BOM", label: "Mumbai", city: "Mumbai", ll: [72.88, 19.08] as [number, number], rtt: 58 },
  { id: "TYO", label: "Tokyo", city: "Tokyo", ll: [139.69, 35.69] as [number, number], rtt: 70 },
  { id: "SYD", label: "Sydney", city: "Sydney", ll: [151.21, -33.87] as [number, number], rtt: 92 },
  { id: "NYC", label: "New York", city: "New York", ll: [-74.0, 40.71] as [number, number], rtt: 142 },
];
export const SINGAPORE: [number, number] = [103.82, 1.35];

// Attack simulation (spec §25) — illustrative numbers.
export const ATTACK = { peakRps: 12400, total: 12400, blocked: 11920, forwarded: 480, originCpu: 21 };

// Burst simulation model: requests arrive from many IPs; the real rule allows 5 req / 10 s per IP.
export function simulateBurst(total: number) {
  const ips = Math.max(1, Math.ceil(total / 25));
  const allowed = Math.min(total, ips * 5);
  return { total, ips, allowed, blocked: total - allowed };
}
