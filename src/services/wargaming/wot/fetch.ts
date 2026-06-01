import { env } from "env";
import { traced } from "@/lib/perf-trace";
import { Region } from "./index";

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
const MAX_RETRIES = 4;
const RETRY_DELAYS_MS = [250, 500, 1000, 2000];

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

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isRetriable(err)) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 1000));
    }
  }
  throw lastErr;
}

export async function wgFetch<T>(
  region: Region,
  path: string,
  params: Record<string, string>,
  revalidate = 60,
): Promise<T> {
  const url = new URL(`https://${REGION_API_HOST[region]}${path}`);
  url.searchParams.set("application_id", applicationIdFor(region));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return traced(`wgFetch ${region} ${path}`, () =>
    withRetries(async () => {
      const res = await fetch(url, { next: { revalidate } });
      if (!res.ok) {
        throw new Error(`Wargaming API HTTP ${res.status}: ${res.statusText}`);
      }

      const body = (await res.json()) as WgResponse<T>;
      if (body.status === "error") {
        throw new WargamingApiError(body.error.message, body.error.field);
      }
      return body.data;
    }),
  );
}

const PORTAL_TIMEOUT_MS = 30_000;

export async function portalFetch<T>(url: URL): Promise<T> {
  const headers: Record<string, string> = {
    "x-requested-with": "XMLHttpRequest",
    accept: "application/json",
    "accept-language": "en",
  };

  return traced(`portalFetch ${url.pathname}`, () =>
    withRetries(async () => {
      // 10s default is aggressive — the WG portal is sometimes slow but reachable
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(PORTAL_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`portal HTTP ${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as T;
    }),
  );
}
