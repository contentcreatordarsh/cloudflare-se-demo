import { useSyncExternalStore } from "react";

export type Route = "/" | "/inspector" | "/security" | "/rate-limiting" | "/tls" | "/staff" | "/logs" | "/settings";
export const ROUTES: Route[] = ["/", "/inspector", "/security", "/rate-limiting", "/tls", "/staff", "/logs", "/settings"];

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("popstate", fn);
  return () => { listeners.delete(fn); window.removeEventListener("popstate", fn); };
};
const current = (): Route => {
  const p = window.location.pathname.replace(/\/+$/, "") || "/";
  return (ROUTES as string[]).includes(p) ? (p as Route) : "/";
};

export function navigate(to: Route, opts: { hash?: string } = {}) {
  const url = to + (opts.hash ? `#${opts.hash}` : "");
  if (window.location.pathname !== to || opts.hash) window.history.pushState(null, "", url);
  listeners.forEach((l) => l());
  if (opts.hash) requestAnimationFrame(() => document.getElementById(opts.hash!)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  else window.scrollTo({ top: 0 });
}

export const useRoute = () => useSyncExternalStore(subscribe, current);
