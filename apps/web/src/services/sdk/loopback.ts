import { LOCAL_ROUTES, type LocalRouteModule } from "./local-routes.generated";

// In-process loopback for the SDK, installed on the server (build AND runtime).
//
// The front fetches its own public API through the SDK, server-side included.
// Doing that over HTTP to `127.0.0.1:${PORT}/api` means the one Node process is
// both the HTTP client and the HTTP server for the call: rendering (CPU) and
// serving that self-request fight over the single event loop, so under a cache
// miss the self-connect starves the accept queue and times out (the exact
// self-fetch anti-pattern Vercel warns against). Instead we dispatch a matched
// GET straight to the in-process route handler: same public contract, same
// per-endpoint `unstable_cache`, zero socket, no event-loop contention.
//
//  - **Build** (`next build`): a no-match MUST throw, because a build must never
//    depend on a running API (the deployed one may lag a deploy behind, and the
//    build environment may have none). `buildSafe` catches it and prerenders an
//    empty shell that heals on first revalidation.
//  - **Runtime**: a no-match (or any non-GET, e.g. a mutation) falls back to the
//    real HTTP `fetch`, so nothing the registry can't place silently breaks.
//
// This module is imported only from `app/layout.tsx` (server graph), so the
// route-handler modules never enter a client bundle. `services/sdk` picks the
// implementation up through a global at call time, keeping its own module
// graph client-safe (the browser never has the global, and falls back to plain
// same-origin fetch there).

function matchRoute(
  pathname: string,
): { load: () => Promise<LocalRouteModule>; params: Record<string, string | string[]> } | null {
  const segments = pathname.split("/").filter(Boolean);
  outer: for (const route of LOCAL_ROUTES) {
    const patternSegments = route.pattern.split("/").filter(Boolean);
    const params: Record<string, string | string[]> = {};
    for (let i = 0; i < patternSegments.length; i++) {
      const pattern = patternSegments[i];
      if (pattern.startsWith("[...") || pattern.startsWith("[[...")) {
        const name = pattern.replace(/^\[+\.\.\./, "").replace(/\]+$/, "");
        params[name] = segments.slice(i).map(decodeURIComponent);
        return { load: route.load, params };
      }
      const segment = segments[i];
      if (segment === undefined) continue outer;
      if (pattern.startsWith("[")) {
        params[pattern.slice(1, -1)] = decodeURIComponent(segment);
      } else if (pattern !== segment) {
        continue outer;
      }
    }
    if (patternSegments.length !== segments.length) continue;
    return { load: route.load, params };
  }
  return null;
}

// Dispatch a request to its in-process route handler, or return null when it
// can't be handled here (not a GET, or no route matches). GET-only: every
// awaitable SDK data method is a GET; mutations (POST/PUT/DELETE) and the SSE /
// NDJSON specials are never rendered server-side, so they belong on real fetch.
// The full URL (query string included) is handed to the handler, so endpoints
// reading `new URL(req.url).searchParams` see their params exactly as over HTTP.
async function dispatchInProcess(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
): Promise<Response | null> {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  if (method !== "GET") return null;
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  const match = matchRoute(url.pathname);
  if (!match) return null;
  const mod = await match.load();
  return mod.GET(new Request(url, init), {
    params: Promise.resolve(match.params),
  });
}

// Build: never touch the network. A request the registry can't place is a bug
// (or an endpoint added after the deployed API), surfaced as a throw for
// `buildSafe` to turn into an empty prerender.
const buildLoopbackFetch: typeof fetch = async (input, init) => {
  const res = await dispatchInProcess(input, init);
  if (res) return res;
  const pathname = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  ).pathname;
  throw new Error(`[sdk loopback] no local route handler for ${pathname}`);
};

// Runtime: in-process for matched GETs, real HTTP for everything else.
const runtimeLoopbackFetch: typeof fetch = async (input, init) =>
  (await dispatchInProcess(input, init)) ?? fetch(input, init);

// Server only (build and runtime). The browser never has this global, so client
// components fall back to plain same-origin fetch; the module itself is
// server-graph only, so the route-handler stack never enters a client bundle.
if (typeof window === "undefined") {
  (globalThis as { __unicumLoopbackFetch?: typeof fetch }).__unicumLoopbackFetch =
    process.env.NEXT_PHASE === "phase-production-build"
      ? buildLoopbackFetch
      : runtimeLoopbackFetch;
}
