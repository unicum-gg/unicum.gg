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

export async function wgFetch<T>(
  region: Region,
  path: string,
  params: Record<string, string>,
  revalidate = 60,
): Promise<T> {
  const url = new URL(`https://${REGION_API_HOST[region]}${path}`);
  url.searchParams.set("application_id", env.WARGAMING_APPLICATION_ID);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`Wargaming API HTTP ${res.status}: ${res.statusText}`);
  }

  const body = (await res.json()) as WgResponse<T>;
  if (body.status === "error") {
    throw new WargamingApiError(body.error.message, body.error.field);
  }
  return body.data;
}
