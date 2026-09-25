// Typed access to the live endpoints. Nothing here is mocked.
//   /cdn-cgi/trace  answered by the Cloudflare edge itself (never reaches AWS)
//   /api/*, /headers answered by the Node origin on EC2 (through Cloudflare -> Nginx)
//   tunnel.strikemap.space/secure/whoami  answered by the Worker behind Cloudflare Access

export interface EdgeTrace {
  colo: string;
  loc: string;
  http: string;
  tls: string;
  kex: string;
  warp: string;
  ms: number; // browser <-> Cloudflare edge round trip for this tiny request
}

export interface CertInfo {
  subject: string;
  san: string[];
  issuerOrg: string;
  issuerCN: string;
  validFrom: string;
  validTo: string;
  daysLeft: number;
  totalDays: number;
  key: string;
  serial: string;
  fingerprint: string;
  protocol?: string;
}

export interface HealthCheck { id: string; name: string; ok: boolean; detail: string }
export interface Status {
  health: { healthy: boolean; checks: HealthCheck[] };
  tunnel: { ready: number; connector: string | null } | null;
  originCert: CertInfo | null;
  edgeCert: CertInfo | null;
  serverTime: string;
}

export interface OriginTrace {
  message: string;
  receivedAt: string;
  ray: string | null;
  colo: string | null;
  country: string | null;
  method: string;
  path: string;
  host: string;
  via: "proxy" | "tunnel" | "direct";
  clientIp: string | null;
  edgeIp: string | null;
  originIp: string | null;
  originTls: { protocol: string | null; cipher: string | null };
  originCert: { issuerOrg: string; issuerCN: string; daysLeft: number; validTo: string } | null;
  appMs: number;
  headers: Record<string, string>;
  payment?: { id: string; amount: number; currency: string; status: string };
}

export interface LogEntry {
  t: string;
  host: string;
  method: string;
  path: string;
  status: number;
  ray: string | null;
  colo: string | null;
  country: string | null;
  ms: number;
}

export interface Identity {
  email: string;
  authenticatedAt: string;
  expiresAt: string;
  country: string | null;
  verifiedBy: string;
}

try { performance.setResourceTimingBufferSize(3000); } catch { /* older browsers */ }

/** Time-to-first-byte for a finished request, from the Resource Timing API (falls back to wall time). */
function netMs(url: string, wall: number): number {
  const list = performance.getEntriesByName(new URL(url, window.location.href).href, "resource") as PerformanceResourceTiming[];
  const e = list[list.length - 1];
  return e && e.requestStart > 0 && e.responseStart >= e.requestStart ? e.responseStart - e.requestStart : wall;
}

const json = async <T,>(r: Response): Promise<T> => {
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return (await r.json()) as T;
};

/** Browser <-> Cloudflare edge round trip: best of three tiny requests answered by the edge itself. */
export async function getEdgeTrace(samples = 3): Promise<EdgeTrace> {
  let text = "", ms = Infinity;
  for (let i = 0; i < samples; i++) {
    const url = `/cdn-cgi/trace?ts=${Date.now()}-${i}`;
    const t0 = performance.now();
    const r = await fetch(url, { cache: "no-store" });
    text = await r.text();
    ms = Math.min(ms, netMs(url, performance.now() - t0));
  }
  const kv = Object.fromEntries(text.trim().split("\n").map((l) => l.split("=") as [string, string]));
  return { colo: kv.colo ?? "", loc: kv.loc ?? "", http: kv.http ?? "", tls: kv.tls ?? "", kex: kv.kex ?? "", warp: kv.warp ?? "off", ms };
}

export const getStatus = () => fetch("/api/status", { cache: "no-store" }).then(json<Status>);
export const getLogs = () => fetch("/api/logs", { cache: "no-store" }).then(json<LogEntry[]>);

export interface Timed<T> { data: T | null; status: number; ray: string | null; ms: number; body?: string }

/** Fetch and time a request; blocked responses (403/429 from the edge) are returned, not thrown. */
export async function timed<T>(url: string): Promise<Timed<T>> {
  const t0 = performance.now();
  const r = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  const ray = r.headers.get("cf-ray");
  const body = await r.text();
  const ms = netMs(url, performance.now() - t0);
  let data: T | null = null;
  if (r.ok) { try { data = JSON.parse(body) as T; } catch { /* non-JSON */ } }
  return { data, status: r.status, ray, ms, body };
}

/** Real Access identity if this browser has a Cloudflare Access session for the staff portal. */
export async function whoami(): Promise<Identity | null> {
  try {
    const r = await fetch("https://tunnel.strikemap.space/secure/whoami", { credentials: "include", redirect: "manual", cache: "no-store" });
    if (r.type === "opaqueredirect" || !r.ok) return null; // Access redirected us to its login page
    return (await r.json()) as Identity;
  } catch {
    return null;
  }
}

export const PORTAL_URL = "https://tunnel.strikemap.space/secure";
export const REPO_URL = "https://github.com/contentcreatordarsh/cloudflare-se-demo";
