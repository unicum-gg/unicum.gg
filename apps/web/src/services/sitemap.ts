import {
  buildUrl,
  getPriority,
  shouldExclude,
  type SitemapConfig,
  type SitemapEntry,
} from "@onruntime/next-sitemap";
import { sql } from "drizzle-orm";
import APP from "@/constants/app";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/translations";
import { REGIONAL_PAGES, REGIONLESS_PAGES } from "@/proxy-routes.generated";
import { db } from "@unicum.gg/core/db";
import {
  clansByRegion,
  playersByRegion,
  tournamentsByRegion,
} from "@unicum.gg/shared";
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { REGIONS, Region } from "@unicum.gg/wargaming";

/**
 * URLs per sitemap file.
 *
 * Google's ceiling is 50,000 URLs OR 50 MB uncompressed, whichever comes first,
 * and with the `hreflang` alternates it is the megabytes that bind: a URL costs
 * ~146 bytes on its own and ~3.7 KB once it names its 36 translations, so the
 * old 25,000 would have produced ~92 MB files, over the limit and silently
 * rejected. Five thousand lands at ~18 MB, which also halves the string a
 * worker has to hold in memory to answer one request.
 */
export const URLS_PER_SITEMAP = 5000;

export function getSitemapCount(
  total: number,
  perPage: number = URLS_PER_SITEMAP,
): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * One entry, in the default language and no other.
 *
 * For a page that genuinely has one: `/docs` is generated from the OpenAPI
 * document and lives outside `app/[locale]`, so it is the only sitemap left
 * with nothing to name. Everything else goes through the localized twin below,
 * and a new section reaching for this one is almost certainly reaching wrong.
 */
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

/**
 * One entry, naming its 36 translations as `hreflang` alternates.
 *
 * What every sitemap but the docs one is built from, entity streams included:
 * a player, clan, tank or tournament page is published in all 36 languages like
 * any other, so the sitemap says so. What it costs is the file size, which is
 * why `URLS_PER_SITEMAP` is what it is.
 *
 * The URLs come from the package's own `buildUrl`, the one the section half is
 * built with, so the two cannot disagree on where a translation lives.
 */
export function createLocalizedSitemapEntry(
  path: string,
  options?: { lastModified?: Date },
): SitemapEntry {
  return {
    ...createSitemapEntry(path, options),
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((locale) => [
          locale,
          buildUrl(APP.URL, path, locale, DEFAULT_LOCALE),
        ]),
      ),
    },
  };
}

export type RegionCounts = Record<
  Region,
  { clans: number; players: number; tanks: number; tournaments: number }
>;

export async function getSitemapCounts(): Promise<RegionCounts> {
  // Per-region counts so each region gets its own sitemap stream — Google can
  // crawl them in parallel and a small region (Asia) isn't blocked behind a
  // big one (EU).
  const counts = await Promise.all(
    REGIONS.map(async (region) => {
      const [clans, players, tanks, tournaments] = await Promise.all([
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
        // Only the mirrored ones: a catalogue row whose bracket has not been
        // read yet renders an empty page, and the sitemap must not offer one.
        db
          .execute<{ count: string }>(
            sql`SELECT COUNT(*)::text AS count FROM ${tournamentsByRegion[region]}
                WHERE detail_synced_at IS NOT NULL`,
          )
          .then((rows) => Number(rows[0]?.count ?? 0)),
      ]);
      return [region, { clans, players, tanks, tournaments }] as const;
    }),
  );
  return Object.fromEntries(counts) as RegionCounts;
}

export const sitemapConfig: Pick<
  SitemapConfig,
  "baseUrl" | "exclude" | "debug" | "locales" | "defaultLocale"
> = {
  baseUrl: APP.URL,
  // The section half only: a bounded list, where one entry per language with
  // `hreflang` alternates is exactly what tells a crawler the translations
  // exist. The entity streams (players, clans, tanks, tournaments, millions of
  // URLs each) stay in the default language on purpose: 36 copies of every
  // player page would multiply the crawl budget of a site whose traffic is
  // already dominated by crawlers, and `hreflang` in the page head says the
  // same thing for the ones actually visited.
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  // Matched against the URLs themselves, never against the route patterns they
  // came from: a pattern reads as a character class to the glob matcher, so
  // `/glossary/[slug]` silently matched `/glossary/s` and nothing else while
  // reading like it covered the section.
  exclude: [
    "/api/*",
    // Covered by `/glossary/sitemap.xml`, down to the index.
    "/glossary",
    "/glossary/**",
    // Covered by `/maps/sitemap.xml`, which carries each region's landing and
    // changes feed beside the maps themselves.
    "/maps",
    "/maps/changes",
    "/*/maps",
    "/*/maps/changes",
  ],
  debug: process.env.NODE_ENV !== "production",
};

/**
 * Every section page, crossed with the regions that serve it.
 *
 * The two lists come from the filesystem via `scripts/generate-page-routes.ts`,
 * so a section added or a shortcut removed changes this by existing. Only the
 * patterns with no dynamic segment left survive, which is exactly the line
 * between a section (`/tanks`, `/na/players`) and an entity (`/eu/tanks/is-7`):
 * the entities are published a stream at a time by the sitemaps below, and must
 * never be enumerated here. The cost is the handful of bounded parameterised
 * pages (`/clans/stronghold/[tier]`, `/maps/all/[type]`), which no sitemap
 * carries today and which the `[slug]` pages they sit beside make unsafe to
 * enumerate blind.
 *
 * It replaces the package's own route walk, which spawns a Node worker per
 * dynamic route to run its `generateStaticParams`. That needs the `.tsx`
 * sources at request time and `output: "standalone"` ships none of them, so
 * anywhere but the build it discovers nothing at all, and the worker loads JSX
 * through a classic-runtime transform, so a page that renders any markup
 * without importing React by name throws rather than answering.
 */
export function sectionPaths(): string[] {
  const bounded = (pattern: string) => !pattern.includes("[");
  const regionless = new Set(REGIONLESS_PAGES.filter(bounded));
  const paths = new Set(regionless);
  for (const pattern of REGIONAL_PAGES.filter(bounded)) {
    for (const region of REGIONS) {
      // `/eu/tanks` is `/tanks` with the default region spelled out, and the
      // page's own canonical says exactly that, so submitting both would offer
      // a crawler a URL we have already told it is not the one.
      if (region === Region.EU && regionless.has(pattern)) continue;
      paths.add(pattern === "/" ? `/${region}` : `/${region}${pattern}`);
    }
  }
  return [...paths]
    .filter((path) => !shouldExclude(path, sitemapConfig.exclude))
    .sort();
}
