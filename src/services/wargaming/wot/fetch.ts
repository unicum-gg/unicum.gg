import { env } from "env";
import { traced } from "@/lib/perf-trace";
import { Region, REGION_PORTAL_HOST } from "./index";
import { acquirePortalToken, acquireWgToken } from "./rate-limit";

const REGION_API_HOST: Record<Region, string> = {
  [Region.EU]: "api.worldoftanks.eu",
  [Region.NA]: "api.worldoftanks.com",
  [Region.ASIA]: "api.worldoftanks.asia",
};

function applicationIdFor(region: Region): string {
  switch (region) {
    case Region.EU:
      return env.WARGAMING_APPLICATION_ID_EU;
    case Region.NA:
      return env.WARGAMING_APPLICATION_ID_NA;
    case Region.ASIA:
      return env.WARGAMING_APPLICATION_ID_ASIA;
  }
}

type WgResponse<T> =
  | { status: "ok"; data: T; meta?: { count: number } }
  | { status: "error"; error: { code: number; message: string; field?: string; value?: string } };

export class WargamingApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(`Wargaming API error: ${code}${field ? ` (${field})` : ""}`);
    this.name = "WargamingApiError";
  }
}

const RETRIABLE_WG_CODES = new Set([
  "SOURCE_NOT_AVAILABLE",
  "REQUEST_LIMIT_EXCEEDED",
]);

const RETRIABLE_NODE_ERROR_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EAI_AGAIN",
]);

function isRetriable(err: unknown): boolean {
  if (err instanceof WargamingApiError) return RETRIABLE_WG_CODES.has(err.code);
  if (err instanceof Error) {
    if (/HTTP (5\d\d|408|429)/.test(err.message)) return true;
    // AbortSignal.timeout fires with a TimeoutError DOMException
    if (err.name === "TimeoutError" || err.name === "AbortError") return true;
    // undici / Node fetch wraps low-level network errors as `fetch failed`
    // with a `cause` field holding the actual error code
    if (err.message.includes("fetch failed")) return true;
    const cause = (err as Error & { cause?: unknown }).cause;
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      typeof cause.code === "string" &&
      RETRIABLE_NODE_ERROR_CODES.has(cause.code)
    ) {
      return true;
    }
  }
  return false;
}

// Both api.worldoftanks.* and *.wargaming.net sit behind G-Core CDN from any
// VPS (DNS geo-routing). negri/wotclans's i*i*2 backoff is the proven safe
// pattern: when a timeout fires, G-Core started dropping our packets, and
// hammering with short linear retries makes the WAF kick in harder. Total
// budget: ~110s across 5 retries.
const RETRY_DELAYS_MS = [2_000, 8_000, 18_000, 32_000, 50_000] as const;

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  const maxRetries = RETRY_DELAYS_MS.length;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries || !isRetriable(err)) throw err;
      await new Promise((r) =>
        setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 1000),
      );
    }
  }
  throw lastErr;
}

const FETCH_TIMEOUT_MS = 30_000;

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" ||
      err.name === "AbortError" ||
      (err as Error & { cause?: { code?: string } }).cause?.code ===
        "UND_ERR_CONNECT_TIMEOUT")
  );
}

export async function wgFetch<T>(
  region: Region,
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`https://${REGION_API_HOST[region]}${path}`);
  url.searchParams.set("application_id", applicationIdFor(region));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // No Next.js fetch cache: every wgFetch caller is either (a) a refresh
  // path that writes the result to Postgres (DB IS the cache), or (b) a
  // page render where caching is owned at the route segment / `unstable_cache`
  // level. Persisting a stale fetch response here would let crons write
  // stale data to DB while believing they refreshed. Intra-render dedup
  // is still free via Next.js's automatic GET memoization.
  return traced(`wgFetch ${region} ${path}`, () =>
    withRetries(async () => {
      // Pace ourselves under G-Core's anti-bot threshold. api.worldoftanks.*
      // is geo-routed to G-Core (92.223.x.x) from any VPS, so the same WAF
      // as the portals applies — see WG_RPS in rate-limit.ts.
      await acquireWgToken(region);
      const t0 = Date.now();
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
          throw new Error(`Wargaming API HTTP ${res.status}: ${res.statusText}`);
        }

        const body = (await res.json()) as WgResponse<T>;
        if (body.status === "error") {
          throw new WargamingApiError(body.error.message, body.error.field);
        }
        return body.data;
      } catch (err) {
        // Watch clusters of these per region to spot when we hit the
        // ceiling while ramping WG_RPS.
        if (isTimeoutError(err)) {
          console.warn(
            `[wgFetch ${region}] TIMEOUT after ${Date.now() - t0}ms on ${path} — G-Core block signal?`,
          );
        }
        throw err;
      }
    }),
  );
}

function portalRegionFromUrl(url: URL): Region | null {
  for (const region of [Region.EU, Region.NA, Region.ASIA]) {
    if (url.host === REGION_PORTAL_HOST[region]) return region;
  }
  return null;
}

export async function portalFetch<T>(url: URL): Promise<T> {
  const headers: Record<string, string> = {
    "x-requested-with": "XMLHttpRequest",
    accept: "application/json",
    "accept-language": "en",
  };
  const region = portalRegionFromUrl(url);
  if (!region) {
    throw new Error(`portalFetch: unknown region for host ${url.host}`);
  }

  return traced(`portalFetch ${region} ${url.pathname}`, () =>
    withRetries(async () => {
      // Per-region 1-RPS token bucket — see PORTAL_RPS in rate-limit.ts for
      // the ramp-up plan (independent per region).
      await acquirePortalToken(region);
      const t0 = Date.now();
      try {
        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
          throw new Error(`portal HTTP ${res.status}: ${res.statusText}`);
        }
        return (await res.json()) as T;
      } catch (err) {
        // Watch clusters of these per region to spot when we hit the
        // ceiling while ramping PORTAL_RPS.
        if (isTimeoutError(err)) {
          console.warn(
            `[portal ${region}] TIMEOUT after ${Date.now() - t0}ms on ${url.pathname} — G-Core block signal?`,
          );
        }
        throw err;
      }
    }),
  );
}
