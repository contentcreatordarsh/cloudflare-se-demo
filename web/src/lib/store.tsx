import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getEdgeTrace, getLogs, getMe, getStatus, timed, whoami,
  type EdgeTrace, type Identity, type LogEntry, type Me, type OriginTrace, type Status,
} from "./api";
import { navigate } from "./router";

export type ExampleKind = "normal" | "waf" | "ratelimit";
export type Verdict = "allowed" | "blocked_waf" | "rate_limited" | "error";
export type Tab = "journey" | "tls" | "ratelimit" | "logs" | "staff";

/** Edge Economics inputs (illustrative model — never an AWS bill). */
export interface Econ { tb: number; pct: number; period: "monthly" | "annual" }

/** A request this browser made during the session — including ones the edge blocked. */
export interface SessionEvent {
  id: string;
  t: string;
  method: string;
  path: string;
  status: number;
  ray: string | null;
  colo: string | null;
  country: string | null;
  ms: number;
  verdict: Verdict;
  origin?: OriginTrace | null; // what the origin reported, when the request reached it
  edgeMs?: number; // browser <-> edge round trip at the time
}

export interface Journey {
  kind: ExampleKind;
  at: string;
  path: string;
  status: number;
  ray: string | null;
  totalMs: number;
  edge: EdgeTrace | null;
  origin: OriginTrace | null; // null when the edge answered (blocked)
  blockedAt: "waf" | "ratelimit" | null;
  originMs: number | null; // derived: total - browser<->edge RTT - app time
  attempts?: { n: number; status: number }[];
  source: "live" | "log";
  method?: string;
  country?: string | null;
  note?: string; // shown under the Journey title when replaying a past request
}

const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour12: false });

/** Rebuild the Request Journey for a request this browser sent earlier in the session. */
export function journeyFromEvent(e: SessionEvent, edge: EdgeTrace | null): Journey {
  const blockedAt = e.verdict === "blocked_waf" ? "waf" : e.verdict === "rate_limited" ? "ratelimit" : null;
  const app = e.origin?.appMs ?? 0;
  return {
    kind: blockedAt === "waf" ? "waf" : blockedAt === "ratelimit" ? "ratelimit" : "normal",
    at: e.t, path: e.path, status: e.status, ray: e.ray, totalMs: e.ms, edge, origin: e.origin ?? null, blockedAt,
    originMs: e.origin && e.edgeMs != null ? Math.max(0.5, e.ms - e.edgeMs - app) : null,
    source: "log", method: e.method, country: e.country,
    note: `Replaying ${e.method} ${e.path.split("?")[0]} sent from this browser at ${hhmmss(e.t)}`,
  };
}

/** Rebuild what we know about a request from the origin's own log (it reached AWS). */
export function journeyFromLog(l: LogEntry): Journey {
  return {
    kind: "normal", at: l.t, path: l.path, status: l.status, ray: l.ray, totalMs: l.ms, edge: null, origin: null,
    blockedAt: null, originMs: null, source: "log", method: l.method, country: l.country,
    note: `From the origin log: ${l.method} ${l.path.split("?")[0]} reached AWS at ${hhmmss(l.t)}`,
  };
}

interface Store {
  status: Status | null;
  statusError: boolean;
  edge: EdgeTrace | null;
  logs: LogEntry[];
  events: SessionEvent[];
  journey: Journey | null;
  running: ExampleKind | null;
  identity: Identity | null | undefined; // undefined = not checked yet
  me: Me | null | undefined; // the console viewer (Access JWT verified by the origin); undefined = loading
  openRequest: (j: Journey) => void; // show a request in the Journey panel, from any page
  tab: Tab;
  attackOpen: boolean;
  econ: Econ;
  setEcon: (e: Partial<Econ>) => void;
  compareOpen: boolean;
  setCompareOpen: (open: boolean) => void;
  setTab: (t: Tab) => void;
  setAttackOpen: (open: boolean) => void;
  runExample: (kind: ExampleKind) => Promise<Journey | null>;
  showJourney: (j: Journey) => void;
  record: (e: Omit<SessionEvent, "id">) => void;
  refreshIdentity: () => Promise<void>;
  refreshLogs: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
};

const coloOf = (ray: string | null) => (ray && ray.includes("-") ? ray.split("-").pop()!.toUpperCase() : null);
export const verdictOf = (status: number): Verdict =>
  status === 403 ? "blocked_waf" : status === 429 ? "rate_limited" : status >= 200 && status < 400 ? "allowed" : "error";

export const XSS_PROBE = `/api/quote?pair=${encodeURIComponent('<script>alert("pwned")</script>')}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [edge, setEdge] = useState<EdgeTrace | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [running, setRunning] = useState<ExampleKind | null>(null);
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("journey");
  const [attackOpen, setAttackOpen] = useState(false);
  const [econ, setEconState] = useState<Econ>({ tb: 50, pct: 42, period: "monthly" });
  const setEcon = useCallback((e: Partial<Econ>) => setEconState((prev) => ({ ...prev, ...e })), []);
  const [compareOpen, setCompareOpen] = useState(false);
  const seq = useRef(0);

  const record = useCallback((e: Omit<SessionEvent, "id">) => {
    setEvents((prev) => [{ ...e, id: `e${++seq.current}` }, ...prev].slice(0, 200));
  }, []);

  const refreshLogs = useCallback(async () => {
    try { setLogs(await getLogs()); } catch { /* keep last */ }
  }, []);
  const refreshIdentity = useCallback(async () => { setIdentity(await whoami()); }, []);

  useEffect(() => {
    let alive = true;
    const loadStatus = async () => {
      try { const s = await getStatus(); if (alive) { setStatus(s); setStatusError(false); } }
      catch { if (alive) setStatusError(true); }
    };
    loadStatus();
    getEdgeTrace().then((e) => alive && setEdge(e)).catch(() => {});
    refreshLogs();
    refreshIdentity();
    getMe().then((m) => alive && setMe(m));
    const s = setInterval(loadStatus, 20000);
    const l = setInterval(() => { if (!document.hidden) refreshLogs(); }, 6000);
    return () => { alive = false; clearInterval(s); clearInterval(l); };
  }, [refreshLogs, refreshIdentity]);

  const runExample = useCallback(async (kind: ExampleKind): Promise<Journey | null> => {
    setRunning(kind);
    try {
      const e = await getEdgeTrace().catch(() => null);
      if (e) setEdge(e);
      const edgeMs = e?.ms ?? 0;
      const at = new Date().toISOString();

      if (kind === "ratelimit") {
        const attempts: { n: number; status: number }[] = [];
        let last: Awaited<ReturnType<typeof timed<unknown>>> | null = null;
        let path = "";
        for (let n = 1; n <= 12; n++) {
          path = `/headers?burst=${n}`;
          last = await timed<unknown>(`${path}&ts=${Date.now()}`);
          attempts.push({ n, status: last.status });
          record({ t: new Date().toISOString(), method: "GET", path, status: last.status, ray: last.ray, colo: coloOf(last.ray), country: e?.loc ?? null, ms: last.ms, verdict: verdictOf(last.status), edgeMs });
          if (last.status === 429) break;
        }
        const j: Journey = {
          kind, at, path, status: last!.status, ray: last!.ray, totalMs: last!.ms, edge: e, origin: null,
          blockedAt: last!.status === 429 ? "ratelimit" : null, originMs: null, attempts, source: "live",
        };
        setJourney(j);
        return j;
      }

      const path = kind === "waf" ? XSS_PROBE : `/api/quote?pair=BTC-SGD`;
      const r = await timed<OriginTrace>(`${path}${path.includes("?") ? "&" : "?"}ts=${Date.now()}`);
      record({ t: new Date().toISOString(), method: "GET", path: decodeURIComponent(path), status: r.status, ray: r.ray, colo: coloOf(r.ray), country: e?.loc ?? null, ms: r.ms, verdict: verdictOf(r.status), origin: r.data, edgeMs });
      const app = r.data?.appMs ?? 0;
      const j: Journey = {
        kind, at, path: decodeURIComponent(path), status: r.status, ray: r.ray, totalMs: r.ms, edge: e, origin: r.data,
        blockedAt: r.status === 403 ? "waf" : r.status === 429 ? "ratelimit" : null,
        originMs: r.data ? Math.max(0.5, r.ms - edgeMs - app) : null, source: "live",
      };
      setJourney(j);
      refreshLogs();
      return j;
    } catch {
      return null;
    } finally {
      setRunning(null);
    }
  }, [record, refreshLogs]);

  // Show any request in the Journey panel: switch to the Overview, open the journey tab and scroll to it.
  const openRequest = useCallback((j: Journey) => {
    setJourney(j);
    setTab("journey");
    if (window.location.pathname !== "/") navigate("/");
    window.setTimeout(() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, []);

  const value = useMemo<Store>(() => ({
    status, statusError, edge, logs, events, journey, running, identity, me, openRequest, tab, attackOpen, econ, setEcon, compareOpen, setCompareOpen,
    setTab, setAttackOpen, runExample, showJourney: setJourney, record, refreshIdentity, refreshLogs,
  }), [status, statusError, edge, logs, events, journey, running, identity, me, openRequest, tab, attackOpen, econ, setEcon, compareOpen, runExample, record, refreshIdentity, refreshLogs]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
