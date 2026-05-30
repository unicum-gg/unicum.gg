import { env } from "env";

export const REGIONS = ["eu", "na", "asia"] as const;
export type Region = (typeof REGIONS)[number];

export function isRegion(value: string): value is Region {
  return (REGIONS as readonly string[]).includes(value);
}

const REGION_API_HOST: Record<Region, string> = {
  eu: "api.worldoftanks.eu",
  na: "api.worldoftanks.com",
  asia: "api.worldoftanks.asia",
};

export const REGION_PORTAL_HOST: Record<Region, string> = {
  eu: "eu.wargaming.net",
  na: "na.wargaming.net",
  asia: "asia.wargaming.net",
};

export const REGION_LABEL: Record<Region, string> = {
  eu: "EU",
  na: "NA",
  asia: "ASIA",
};

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
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [250, 750];

function isRetriable(err: unknown): boolean {
  if (err instanceof WargamingApiError) return RETRIABLE_WG_CODES.has(err.code);
  if (err instanceof Error && /HTTP (5\d\d|408|429)/.test(err.message)) {
    return true;
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
  const url = region === "asia"
    ? new URL(`${env.WG_ASIA_PROXY_URL}/papi${path}`)
    : new URL(`https://${REGION_API_HOST[region]}${path}`);
  url.searchParams.set("application_id", env.WARGAMING_APPLICATION_ID);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: HeadersInit = region === "asia"
    ? { Authorization: `Bearer ${env.WG_ASIA_PROXY_SECRET}` }
    : {};

  return withRetries(async () => {
    const res = await fetch(url, { headers, next: { revalidate } });
    if (!res.ok) {
      throw new Error(`Wargaming API HTTP ${res.status}: ${res.statusText}`);
    }

    const body = (await res.json()) as WgResponse<T>;
    if (body.status === "error") {
      throw new WargamingApiError(body.error.message, body.error.field);
    }
    return body.data;
  });
}

export async function portalFetch<T>(url: URL): Promise<T> {
  const target = url.host === REGION_PORTAL_HOST.asia
    ? new URL(`${env.WG_ASIA_PROXY_URL}/portal${url.pathname}${url.search}`)
    : url;

  const headers: Record<string, string> = {
    "x-requested-with": "XMLHttpRequest",
    accept: "application/json",
    "accept-language": "en",
  };
  if (url.host === REGION_PORTAL_HOST.asia) {
    headers.Authorization = `Bearer ${env.WG_ASIA_PROXY_SECRET}`;
  }

  return withRetries(async () => {
    const res = await fetch(target, { headers });
    if (!res.ok) {
      throw new Error(`portal HTTP ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as T;
  });
}
