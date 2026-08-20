import {
  getPriority,
  type SitemapConfig,
  type SitemapEntry,
} from "@onruntime/next-sitemap";
import { sql } from "drizzle-orm";
import APP from "@/constants/app";
import { db } from "@unicum.gg/core/db";
import {
  clansByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { REGIONS, type Region } from "@unicum.gg/wargaming";

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

export type RegionCounts = Record<
  Region,
  { clans: number; players: number; tanks: number }
>;

export async function getSitemapCounts(): Promise<RegionCounts> {
  // Per-region counts so each region gets its own sitemap stream — Google can
  // crawl them in parallel and a small region (Asia) isn't blocked behind a
  // big one (EU).
  const counts = await Promise.all(
    REGIONS.map(async (region) => {
      const [clans, players, tanks] = await Promise.all([
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
        // Tanks come from the bounded catalogue, not a DB table.
        listTanks(region).then((t) => t.length),
      ]);
      return [region, { clans, players, tanks }] as const;
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
    "/[region]/tanks/[slug]",
    // Covered by /glossary/sitemap.xml
    "/glossary",
    "/glossary/[slug]",
    "/glossary/category/[category]",
  ],
  debug: process.env.NODE_ENV !== "production",
};
