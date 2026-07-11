import { Region, REGION_API_HOST, REGION_PORTAL_HOST } from "../region";
import type { WgLanguage } from "../language";
import {
  type WgRateLimiter,
  type RateLimiterFactory,
  type RegionRps,
  RateLimit,
  DEFAULT_WG_RPS,
  DEFAULT_PORTAL_RPS,
  regionLimiters,
} from "./rate-limiter";
import { CacheManager, type CacheOptions } from "./cache/manager";

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
// in harder). ~110s across 5 retries.
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
  readonly #wgLimiters: Record<Region, WgRateLimiter>;
  readonly #portalLimiters: Record<Region, WgRateLimiter>;
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
    const limiterFactory = opts.rateLimit?.factory;
    this.#wgLimiters = regionLimiters(
      { ...DEFAULT_WG_RPS, ...opts.rateLimit?.wg },
      RateLimit.Wg,
      limiterFactory,
    );
    this.#portalLimiters = regionLimiters(
      { ...DEFAULT_PORTAL_RPS, ...opts.rateLimit?.portal },
      RateLimit.Portal,
      limiterFactory,
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

  #withHeaders(region: Region, extra?: Record<string, string>): Record<string, string> {
    return { ...(this.#headers?.(region) ?? {}), ...extra };
  }

  #trace_<T>(label: string, fn: () => Promise<T>): Promise<T> {
    return this.#trace ? this.#trace(label, fn) : fn();
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
    opts?: { cache?: number | false; method?: "GET" | "POST" },
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
        await this.#wgLimiters[region].acquire();
        const t0 = Date.now();
        try {
          const res = await fetch(url, {
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
          });
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
        await this.#portalLimiters[region].acquire();
        const t0 = Date.now();
        try {
          const res = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
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
        if (limit === RateLimit.Wg && region) await this.#wgLimiters[region].acquire();
        else if (limit === RateLimit.Portal && region)
          await this.#portalLimiters[region].acquire();
        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
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
        if (limit === RateLimit.Wg && region) await this.#wgLimiters[region].acquire();
        else if (limit === RateLimit.Portal && region)
          await this.#portalLimiters[region].acquire();
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText} on ${url.pathname}`);
        return (await res.json()) as T;
      }),
    );
  }
}
