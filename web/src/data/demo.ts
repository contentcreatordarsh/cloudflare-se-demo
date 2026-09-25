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
  good: "up" | "down";
  color: string;
  data: { i: number; v: number }[];
}

export const KPIS: Kpi[] = [
  { id: "total", label: "Total Requests", value: 12842, delta: 12, good: "up", color: "#3b82f6", data: series(7, 24, 520, 90, 4) },
  { id: "waf", label: "Blocked (WAF)", value: 1284, delta: 8, good: "down", color: "#ef4444", data: series(11, 24, 48, 22, 0.8, [17, 21]) },
  { id: "rl", label: "Rate Limited", value: 92, delta: -24, good: "down", color: "#f59e0b", data: series(3, 24, 5, 4, -0.08, [9]) },
  { id: "origin", label: "Origin Requests", value: 480, delta: -73, good: "down", color: "#22c55e", data: series(5, 24, 20, 8, -0.2) },
  { id: "latency", label: "Avg. Latency (Edge)", value: 48, unit: "ms", delta: -36, good: "down", color: "#5b9bff", data: series(13, 24, 52, 10, -0.35) },
];

export const TRAFFIC_MIX = [
  { key: "allowed", label: "Allowed", pct: 75, color: "#3b82f6" },
  { key: "blocked", label: "Blocked", pct: 15, color: "#ef4444" },
  { key: "ratelimited", label: "Rate Limited", pct: 5, color: "#f59e0b" },
  { key: "challenged", label: "Challenged", pct: 3, color: "#8b5cf6" },
  { key: "origin", label: "Origin", pct: 2, color: "#22c55e" },
] as const;

// Globe traffic sources -> Singapore. RTTs are typical public-internet round trips to Singapore.
export const SOURCES = [
  { id: "EU", label: "EU", city: "Frankfurt", ll: [8.68, 50.11] as [number, number], rtt: 155 },
  { id: "IN", label: "IN", city: "Mumbai", ll: [72.88, 19.08] as [number, number], rtt: 58 },
  { id: "JP", label: "JP", city: "Tokyo", ll: [139.69, 35.69] as [number, number], rtt: 70 },
  { id: "AU", label: "AU", city: "Sydney", ll: [151.21, -33.87] as [number, number], rtt: 92 },
  { id: "US", label: "US", city: "Los Angeles", ll: [-118.24, 34.05] as [number, number], rtt: 175 },
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
