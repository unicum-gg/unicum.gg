import { Region, REGION_API_HOST, REGION_PORTAL_HOST } from "../region";
import type { WgLanguage } from "../language";
import {
  type RateLimiterFactory,
  type RegionRps,
  type Lane,
  type EgressConfig,
  RateLimit,
  DEFAULT_WG_RPS,
  DEFAULT_PORTAL_RPS,
  regionLanes,
} from "./rate-limiter";
import { CacheManager, type CacheOptions } from "./cache/manager";

// `dispatcher` is an undici extension to fetch's RequestInit (not in the DOM
// lib types), so we widen the init when binding a request to an egress lane.
type FetchInit = RequestInit & { dispatcher?: unknown };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Default cache TTLs for the handful of essentially-static WG endpoints, keyed
 * by path prefix. Everything else (player/clan/live data) is never cached so
 * the app's DB-backed freshness model stays authoritative. Overridable per call
 * via `wgFetch`'s `cache` option.
 */
const STATIC_CACHE_TTL: ReadonlyArray<readonly [string, number]> = [
  ["/wot/encyclopedia/", 6 * HOUR],
  ["/wot/clans/glossary/", 24 * HOUR],
  ["/wot/ratings/types/", 24 * HOUR],
  ["/wot/clanratings/types/", 24 * HOUR],
];

function defaultCacheTtl(path: string): number {
  for (const [prefix, ttl] of STATIC_CACHE_TTL) {
    if (path.startsWith(prefix)) return ttl;
  }
  return 0;
}

// Egress request counter, keyed `api:<region>` / `portal:<region>`. Incremented
// in `#pickLane`, which every real network attempt passes through exactly once
// (cache hits short-circuit before it), so this is the true count of requests
// leaving for WG — including retries — across every consumer sharing the client.
// The proxy can't see this (CONNECT tunnels are opaque TLS), so it's the only
// place the real per-region req/s is observable. Drain + log it on a heartbeat.
const wgRequestCounts: Record<string, number> = {};

/** Read and reset the per-region/lane egress request counts since the last drain. */
export function drainWgRequestCounts(): Record<string, number> {
  const snapshot = { ...wgRequestCounts };
  for (const key of Object.keys(wgRequestCounts)) wgRequestCounts[key] = 0;
  return snapshot;
}

export type WargamingClientOptions = {
  /** WG `application_id` per region — a map or a resolver. */
  applicationId: Partial<Record<Region, string>> | ((region: Region) => string);
  /**
   * Default localization applied to every API call (the `language` param).
   * Overridable per call. Like `application_id`, set it once here instead of
   * threading it through every method.
   */
  language?: WgLanguage;
  /** Extra headers per request (e.g. an identified-bot User-Agent + contact). */
  headers?: (region: Region) => Record<string, string>;
  /** Optional tracing wrapper (e.g. perf timing). Defaults to passthrough. */
  trace?: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  /**
   * Override the per-region request-per-second caps, and/or supply a `factory`
   * to build shared/distributed limiters (e.g. Redis) instead of the default
   * per-process in-memory buckets — required to keep one WG budget across
   * multiple app instances.
   */
  rateLimit?: {
    wg?: Partial<RegionRps>;
    portal?: Partial<RegionRps>;
    factory?: RateLimiterFactory;
  };
  /**
   * Spread WG API + portal traffic across multiple source IPs to multiply the
   * per-IP G-Core budget (see rate-limiter DEFAULT_WG_RPS). Requests round-robin
   * over the region's IPs, each bound to its own socket and rate-limited on its
   * own bucket. Omit for the default single-egress behavior.
   */
  egress?: EgressConfig;
  /** Response caching for static endpoints (encyclopedia, glossaries, …). */
  cache?: CacheOptions;
};

export class WargamingApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(`Wargaming API error: ${code}${field ? ` (${field})` : ""}`);
    this.name = "WargamingApiError";
  }
}

type WgEnvelope<T> =
  | { status: "ok"; data: T; meta?: { count: number } }
  | { status: "error"; error: { code: number; message: string; field?: string; value?: string } };

const RETRIABLE_WG_CODES = new Set(["SOURCE_NOT_AVAILABLE", "REQUEST_LIMIT_EXCEEDED"]);
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
    if (err.name === "TimeoutError" || err.name === "AbortError") return true;
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

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" ||
      err.name === "AbortError" ||
      (err as Error & { cause?: { code?: string } }).cause?.code ===
        "UND_ERR_CONNECT_TIMEOUT")
  );
}

// Both api.worldoftanks.* and *.wargaming.net sit behind G-Core CDN. i*i*2
// backoff is the proven-safe pattern (short linear retries make the WAF kick
// in harder). ~110s across 5 retries. (G-Core WAF mechanism + the empirical
// per-IP RPS ceilings: see rate-limiter.ts DEFAULT_WG_RPS.)
const RETRY_DELAYS_MS = [2_000, 8_000, 18_000, 32_000, 50_000] as const;
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Per-client transport: holds the config (app ids, headers, tracing) and the
 * per-region rate limiters, and exposes the fetch primitives every resource
 * uses. Nothing here is global — two clients are fully independent.
 */
export class Transport {
  readonly #appId: (region: Region) => string;
  readonly #language?: WgLanguage;
  readonly #headers?: (region: Region) => Record<string, string>;
  readonly #trace?: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  // The fetch used for every request. When egress is configured this is the
  // app's undici `fetch`, paired with the lane dispatchers (Node's global fetch
  // silently ignores a foreign-undici dispatcher). Else it's the global fetch.
  readonly #fetch: typeof fetch;
  // Per region, the egress lanes to round-robin over (one per source IP, or a
  // single default lane with no dispatcher when egress is unset).
  readonly #wgLanes: Record<Region, Lane[]>;
  readonly #portalLanes: Record<Region, Lane[]>;
  readonly #wgCursor: Record<Region, number> = {
    [Region.EU]: 0,
    [Region.NA]: 0,
    [Region.ASIA]: 0,
  };
  readonly #portalCursor: Record<Region, number> = {
    [Region.EU]: 0,
    [Region.NA]: 0,
    [Region.ASIA]: 0,
  };
  readonly #cache?: CacheManager;

  constructor(opts: WargamingClientOptions) {
    const appId = opts.applicationId;
    this.#appId =
      typeof appId === "function"
        ? appId
        : (region) => {
            const id = appId[region];
            if (!id) throw new Error(`No Wargaming application_id for region "${region}"`);
            return id;
          };
    this.#language = opts.language;
    this.#headers = opts.headers;
    this.#trace = opts.trace;
    this.#fetch = opts.egress?.fetchImpl ?? globalThis.fetch;
    const limiterFactory = opts.rateLimit?.factory;
    this.#wgLanes = regionLanes(
      { ...DEFAULT_WG_RPS, ...opts.rateLimit?.wg },
      RateLimit.Wg,
      limiterFactory,
      opts.egress,
    );
    this.#portalLanes = regionLanes(
      { ...DEFAULT_PORTAL_RPS, ...opts.rateLimit?.portal },
      RateLimit.Portal,
      limiterFactory,
      opts.egress,
    );
    if (opts.cache?.enabled ?? true) {
      this.#cache = new CacheManager({ store: opts.cache?.store, maxSize: opts.cache?.maxSize });
    }
  }

  /** Empty the response cache. */
  clearCache(): Promise<void> {
    return this.#cache?.clear() ?? Promise.resolve();
  }

  /** Inspect the response cache (entry count + keys). */
  cacheStats(): Promise<{ size: number; keys: string[] }> {
    return this.#cache?.stats() ?? Promise.resolve({ size: 0, keys: [] });
  }

  applicationId(region: Region): string {
    return this.#appId(region);
  }

  /**
   * The default `language` applied to every call, if configured. Exposed for URL
   * builders (e.g. `auth.loginUrl`) that assemble a browser-facing request URL
   * without going through `wgFetch`, so they can match its param handling.
   */
  defaultLanguage(): WgLanguage | undefined {
    return this.#language;
  }

  #withHeaders(region: Region, extra?: Record<string, string>): Record<string, string> {
    return { ...(this.#headers?.(region) ?? {}), ...extra };
  }

  #trace_<T>(label: string, fn: () => Promise<T>): Promise<T> {
    return this.#trace ? this.#trace(label, fn) : fn();
  }

  /**
   * Next egress lane for a region (round-robin). Never empty: a region always
   * has at least the default lane. Callers acquire `lane.limiter` and pass
   * `lane.dispatcher` to fetch so the request goes out the chosen source IP on
   * its own rate budget.
   */
  #pickLane(kind: RateLimit.Wg | RateLimit.Portal, region: Region): Lane {
    const lanes =
      kind === RateLimit.Wg ? this.#wgLanes[region] : this.#portalLanes[region];
    const cursor =
      kind === RateLimit.Wg ? this.#wgCursor : this.#portalCursor;
    const i = cursor[region] % lanes.length;
    cursor[region] = (i + 1) % lanes.length;
    const laneKind = kind === RateLimit.Wg ? "api" : "portal";
    const key = `${laneKind}:${region}`;
    wgRequestCounts[key] = (wgRequestCounts[key] ?? 0) + 1;
    return lanes[i]!;
  }

  async #withRetries<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt === RETRY_DELAYS_MS.length || !isRetriable(err)) throw err;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 1000));
      }
    }
    throw lastErr;
  }

  /**
   * Official WG API call: adds `application_id`, wg rate limit, WG envelope.
   * `opts.cache` overrides the default per-endpoint TTL: a number forces a TTL
   * (ms) for this call, `false` bypasses the cache entirely.
   */
  async wgFetch<T>(
    region: Region,
    path: string,
    params: Record<string, string>,
    opts?: {
      cache?: number | false;
      method?: "GET" | "POST";
      /**
       * Bypass the per-region rate limiter for this call. Reserved for rare,
       * user-blocking interactive calls (e.g. verifying a token during login)
       * that must not queue behind background traffic. Never use it for bulk or
       * background work, or the shared WG budget stops meaning anything.
       */
      skipRateLimit?: boolean;
    },
  ): Promise<T> {
    const method = opts?.method ?? "GET";
    const url = new URL(`https://${REGION_API_HOST[region]}${path}`);

    // WG's auth-mutating endpoints (`auth/prolongate`, `auth/logout`) require
    // POST and read their params — notably `access_token` — only from the form
    // body: a GET with the token in the query string returns
    // ACCESS_TOKEN_NOT_SPECIFIED, so tokens never leak into URLs or logs. Send
    // everything in the body and never cache these.
    let formBody: string | undefined;
    if (method === "POST") {
      const form = new URLSearchParams({
        application_id: this.#appId(region),
        ...params,
      });
      if (this.#language && !("language" in params)) {
        form.set("language", this.#language);
      }
      formBody = form.toString();
    } else {
      url.searchParams.set("application_id", this.#appId(region));
      if (this.#language && !("language" in params)) {
        url.searchParams.set("language", this.#language);
      }
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const ttl =
      method === "POST"
        ? 0
        : opts?.cache === false
          ? 0
          : (opts?.cache ?? defaultCacheTtl(path));
    const cacheKey = this.#cache && ttl > 0 ? `GET:${url.toString()}` : null;
    if (cacheKey) {
      const hit = await this.#cache!.get<T>(cacheKey);
      if (hit !== undefined) return hit;
    }

    const data = await this.#trace_(`wgFetch ${region} ${path}`, () =>
      this.#withRetries(async () => {
        const lane = this.#pickLane(RateLimit.Wg, region);
        if (!opts?.skipRateLimit) await lane.limiter.acquire();
        const t0 = Date.now();
        try {
          const res = await this.#fetch(url, {
            method,
            cache: "no-store",
            headers:
              method === "POST"
                ? this.#withHeaders(region, {
                    "content-type": "application/x-www-form-urlencoded",
                  })
                : this.#withHeaders(region),
            body: formBody,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            dispatcher: lane.dispatcher,
          } as FetchInit);
          if (!res.ok) throw new Error(`Wargaming API HTTP ${res.status}: ${res.statusText}`);
          const envelope = (await res.json()) as WgEnvelope<T>;
          if (envelope.status === "error") {
            throw new WargamingApiError(envelope.error.message, envelope.error.field);
          }
          return envelope.data;
        } catch (err) {
          if (isTimeoutError(err)) {
            console.warn(
              `[wgFetch ${region}] TIMEOUT after ${Date.now() - t0}ms on ${path} — G-Core block signal?`,
            );
          }
          throw err;
        }
      }),
    );

    if (cacheKey) await this.#cache!.set(cacheKey, data, ttl);
    return data;
  }

  /** Clan portal call (`<region>.wargaming.net`): portal rate limit + headers. */
  portalFetch<T>(region: Region, url: URL): Promise<T> {
    const headers = this.#withHeaders(region, {
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json",
    });
    return this.#trace_(`portalFetch ${region} ${url.pathname}`, () =>
      this.#withRetries(async () => {
        const lane = this.#pickLane(RateLimit.Portal, region);
        await lane.limiter.acquire();
        const t0 = Date.now();
        try {
          const res = await this.#fetch(url, {
            headers,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            dispatcher: lane.dispatcher,
          } as FetchInit);
          if (!res.ok) throw new Error(`portal HTTP ${res.status}: ${res.statusText}`);
          return (await res.json()) as T;
        } catch (err) {
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

  /**
   * Low-level GET with retries + optional per-region rate limit, for WG
   * endpoints on non-standard hosts/shapes (stronghold game_api, globalmap,
   * wgn servers) and third-party sources. Returns the raw `Response`.
   */
  get(
    url: URL,
    opts?: { region?: Region; limit?: RateLimit; headers?: Record<string, string> },
  ): Promise<Response> {
    const region = opts?.region;
    const limit = opts?.limit ?? (region ? RateLimit.Wg : RateLimit.None);
    const headers = region
      ? this.#withHeaders(region, opts?.headers)
      : { ...(opts?.headers ?? {}) };
    return this.#trace_(`get ${url.host}${url.pathname}`, () =>
      this.#withRetries(async () => {
        let lane: Lane | undefined;
        if (limit === RateLimit.Wg && region) lane = this.#pickLane(RateLimit.Wg, region);
        else if (limit === RateLimit.Portal && region)
          lane = this.#pickLane(RateLimit.Portal, region);
        if (lane) await lane.limiter.acquire();
        const res = await this.#fetch(url, {
          headers,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          dispatcher: lane?.dispatcher,
        } as FetchInit);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText} on ${url.pathname}`);
        return res;
      }),
    );
  }

  async getJson<T>(
    url: URL,
    opts?: { region?: Region; limit?: RateLimit; headers?: Record<string, string> },
  ): Promise<T> {
    const res = await this.get(url, opts);
    return (await res.json()) as T;
  }

  /**
   * Low-level JSON POST with the same retries + optional per-region rate limit
   * as `get`, for the handful of portal SPA endpoints that only accept POST
   * (e.g. the profile vehicles list).
   */
  async postJson<T>(
    url: URL,
    body: unknown,
    opts?: { region?: Region; limit?: RateLimit; headers?: Record<string, string> },
  ): Promise<T> {
    const region = opts?.region;
    const limit = opts?.limit ?? (region ? RateLimit.Wg : RateLimit.None);
    const headers = {
      "content-type": "application/json; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      ...(region ? this.#withHeaders(region, opts?.headers) : opts?.headers ?? {}),
    };
    return this.#trace_(`postJson ${url.host}${url.pathname}`, () =>
      this.#withRetries(async () => {
        let lane: Lane | undefined;
        if (limit === RateLimit.Wg && region) lane = this.#pickLane(RateLimit.Wg, region);
        else if (limit === RateLimit.Portal && region)
          lane = this.#pickLane(RateLimit.Portal, region);
        if (lane) await lane.limiter.acquire();
        const res = await this.#fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          dispatcher: lane?.dispatcher,
        } as FetchInit);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText} on ${url.pathname}`);
        return (await res.json()) as T;
      }),
    );
  }
}
