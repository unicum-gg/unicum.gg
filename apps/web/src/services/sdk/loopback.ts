import { LOCAL_ROUTES, type LocalRouteModule } from "./local-routes.generated";

// Build-time loopback for the SDK. During `next build`, statically prerendered
// pages (home, landings, lang) fetch through the SDK, but the deployed API may
// be missing endpoints that only ship with this very build, and a build must
// never depend on a running API. So instead of HTTP, dispatch the call to the
// in-process route handler of the commit being built: the same public
// contract, resolved against this build's own code (and the DB the build
// environment already reaches, exactly like the pre-SDK pages did).
//
// This module is imported only from `app/layout.tsx` (server graph), so the
// route-handler modules never enter a client bundle. `services/sdk` picks the
// implementation up through a global at call time, keeping its own module
// graph client-safe.

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

const loopbackFetch: typeof fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  const match = matchRoute(url.pathname);
  if (!match) {
    throw new Error(`[sdk loopback] no local route handler for ${url.pathname}`);
  }
  const mod = await match.load();
  return mod.GET(new Request(url, init), {
    params: Promise.resolve(match.params),
  });
};

if (process.env.NEXT_PHASE === "phase-production-build") {
  (globalThis as { __unicumLoopbackFetch?: typeof fetch }).__unicumLoopbackFetch =
    loopbackFetch;
}
