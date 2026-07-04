export enum Region {
  EU = "eu",
  NA = "na",
  ASIA = "asia",
}

export const REGIONS: Region[] = [Region.EU, Region.NA, Region.ASIA];

export function isRegion(value: string): value is Region {
  return (REGIONS as readonly string[]).includes(value);
}

/**
 * Pulls the region from the first URL segment, or null if the path has no
 * regional prefix (`/`, `/coverage`, etc). Callers pick their own fallback
 * (cookie, default, ...) so the behavior is uniform across the navbar
 * selector, the search dialog, and the SSR layout.
 */
export function regionFromPathname(
  pathname: string | null | undefined,
): Region | null {
  if (!pathname) return null;
  const segment = pathname.split("/")[1];
  return isRegion(segment) ? segment : null;
}

export const REGION_API_HOST: Record<Region, string> = {
  [Region.EU]: "api.worldoftanks.eu",
  [Region.NA]: "api.worldoftanks.com",
  [Region.ASIA]: "api.worldoftanks.asia",
};

export const REGION_PORTAL_HOST: Record<Region, string> = {
  [Region.EU]: "eu.wargaming.net",
  [Region.NA]: "na.wargaming.net",
  [Region.ASIA]: "asia.wargaming.net",
};

export const REGION_WOT_HOST: Record<Region, string> = {
  [Region.EU]: "worldoftanks.eu",
  [Region.NA]: "worldoftanks.com",
  [Region.ASIA]: "worldoftanks.asia",
};

export const REGION_LABEL: Record<Region, string> = {
  [Region.EU]: "EU",
  [Region.NA]: "NA",
  [Region.ASIA]: "ASIA",
};

export const REGION_EMOJI: Record<Region, string> = {
  [Region.EU]: "🌍",
  [Region.NA]: "🌎",
  [Region.ASIA]: "🌏",
};
