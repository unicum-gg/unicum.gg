export enum Region {
  EU = "eu",
  NA = "na",
  ASIA = "asia",
}

export const REGIONS: Region[] = [Region.EU, Region.NA, Region.ASIA];

export function isRegion(value: string): value is Region {
  return (REGIONS as readonly string[]).includes(value);
}

export const REGION_PORTAL_HOST: Record<Region, string> = {
  [Region.EU]: "eu.wargaming.net",
  [Region.NA]: "na.wargaming.net",
  [Region.ASIA]: "asia.wargaming.net",
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
