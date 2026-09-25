import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getEdgeTrace, getLogs, getStatus, timed, whoami,
  type EdgeTrace, type Identity, type LogEntry, type OriginTrace, type Status,
} from "./api";

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
  const [tab, setTab] = useState<Tab>("journey");
  const [attackOpen, setAttackOpen] = useState(false);
  const [econ, setEconState] = useState<Econ>({ tb: 10, pct: 35, period: "monthly" });
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
          record({ t: new Date().toISOString(), method: "GET", path, status: last.status, ray: last.ray, colo: coloOf(last.ray), country: e?.loc ?? null, ms: last.ms, verdict: verdictOf(last.status) });
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
      record({ t: new Date().toISOString(), method: "GET", path: decodeURIComponent(path), status: r.status, ray: r.ray, colo: coloOf(r.ray), country: e?.loc ?? null, ms: r.ms, verdict: verdictOf(r.status) });
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

  const value = useMemo<Store>(() => ({
    status, statusError, edge, logs, events, journey, running, identity, tab, attackOpen, econ, setEcon, compareOpen, setCompareOpen,
    setTab, setAttackOpen, runExample, showJourney: setJourney, record, refreshIdentity, refreshLogs,
  }), [status, statusError, edge, logs, events, journey, running, identity, tab, attackOpen, econ, setEcon, compareOpen, runExample, record, refreshIdentity, refreshLogs]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
