import {
  getPriority,
  type SitemapConfig,
  type SitemapEntry,
} from "@onruntime/next-sitemap";
import { sql } from "drizzle-orm";
import APP from "@/constants/app";
import { db } from "@/services/db";
import {
  clansByRegion,
  playersByRegion,
} from "@/services/db/schema";
import { REGIONS } from "@unicum.gg/wargaming/region";

export const URLS_PER_SITEMAP = 25000;

export function getSitemapCount(
  total: number,
  perPage: number = URLS_PER_SITEMAP,
): number {
  return Math.max(1, Math.ceil(total / perPage));
}

export function createSitemapEntry(
  path: string,
  options?: { lastModified?: Date },
): SitemapEntry {
  return {
    url: `${APP.URL}${path}`,
    lastModified: options?.lastModified ?? new Date(),
    priority: getPriority(path, "auto"),
  };
}

import type { Region } from "@unicum.gg/wargaming/region";

export type RegionCounts = Record<Region, { clans: number; players: number }>;

export async function getSitemapCounts(): Promise<RegionCounts> {
  // Per-region counts so each region gets its own sitemap stream — Google can
  // crawl them in parallel and a small region (Asia) isn't blocked behind a
  // big one (EU).
  const counts = await Promise.all(
    REGIONS.map(async (region) => {
      const [clans, players] = await Promise.all([
        db
          .execute<{ count: string }>(
            sql`SELECT COUNT(*)::text AS count FROM ${clansByRegion[region]}`,
          )
          .then((rows) => Number(rows[0]?.count ?? 0)),
        db
          .execute<{ count: string }>(
            sql`SELECT COUNT(*)::text AS count FROM ${playersByRegion[region]}`,
          )
          .then((rows) => Number(rows[0]?.count ?? 0)),
      ]);
      return [region, { clans, players }] as const;
    }),
  );
  return Object.fromEntries(counts) as RegionCounts;
}

export const sitemapConfig: Pick<
  SitemapConfig,
  "baseUrl" | "exclude" | "debug"
> = {
  baseUrl: APP.URL,
  exclude: [
    // Internal/API routes
    "/api/*",
    // Pages covered by additionalSitemaps (avoid duplication with auto-discovery)
    "/[region]/clans/[tag]",
    "/[region]/players/[nickname]",
  ],
  debug: process.env.NODE_ENV !== "production",
};
