import { UnicumError } from "@unicum.gg/sdk";
import {
  LOADOUT_MODES,
  LoadoutMode,
  type MapDetail,
  type MapRatingSummary,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { MapDetailTab } from "@/components/maps/detail/tabs";
import type { MapHistoryData } from "@/components/maps/detail/history/data";
import type {
  MapStatisticsModeView,
  MapStatisticsPayload,
} from "@/components/maps/detail/statistics/view";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import { EMPTY_MAP_RATING_SUMMARY } from "@/components/maps/detail/community/empty";
import { buildSafe, unicum } from "@/services/sdk";

// The page consumes its own public API through the SDK. Next memoizes identical
// fetches within one render pass, so the layout, the tab and
// `generateMetadata` share a single request for each of these.

/**
 * The catalogue's map, plus the two numbers the endpoint composes onto it.
 *
 * `MapDetail` is the shape the catalogue builds and every component takes, so
 * it stays what the page hands down. The verdict is not part of it: it is
 * joined on by the endpoint, and typing it here is what stops the cast below
 * from quietly erasing it. Optional for the same reason the vehicle page keeps
 * its own optional: the payload is cached and served by an API that can be one
 * deploy behind this render.
 */
export type MapDetailPayload = MapDetail & {
  rating?: { overall: number | null; votes: number; reviewCount: number };
};

export async function loadMapDetail(
  region: Region,
  slug: string,
): Promise<MapDetailPayload | null> {
  try {
    // Cast like every enum crossing the API: the payload carries them as
    // strings and a TS string enum is nominal, so the two are the same
    // characters and not the same type.
    const detail = (await unicum
      .region(region)
      .maps(slug)
      .detail()) as unknown as MapDetailPayload;
    // A slug colliding with a sibling route under `/api/{region}/maps/`
    // (`ratings`, `search`) resolves to THAT endpoint, and both answer 200 with
    // a board payload of their own shape, so the status guard below never
    // fires: `/eu/maps/ratings` and `/eu/maps/search` rendered on `{results:
    // []}` and 500ed where a 404 was owed (measured 2026-10-24). The vehicle
    // pages are immune for a structural reason rather than a better guard: the
    // SDK reads a tank at `/{slug}/detail`, one segment deeper than the
    // siblings, so nothing can collide. Judged on the shape rather than against
    // a list of names, as the player and clan pages are.
    if (typeof detail?.arenaId !== "string") return null;
    return detail;
  } catch (error) {
    // 400 as well as 404: a sibling demanding its own query params answers 400,
    // which the shape guard cannot see. Narrow on purpose, so a 5xx still
    // propagates instead of caching a 404 over it.
    if (
      error instanceof UnicumError &&
      (error.status === 404 || error.status === 400)
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * The community has linked battles on this map, for the Tactics tab.
 *
 * Rendered by the server rather than fetched by the browser: the tactics belong
 * in the HTML, which is what the `.md` twin converts and what a crawler reads.
 * An approved tactic drops the page from the cache (`revalidatePath`), so
 * rendering it server-side costs no freshness.
 */
export async function loadMapVideos(
  region: Region,
  slug: string,
): Promise<TankVideoCardData[]> {
  return buildSafe(() => unicum.region(region).maps(slug).videos(), {
    videos: [],
  }).then((r) => r.videos as unknown as TankVideoCardData[]);
}

/**
 * What updates changed about the map, for the History tab.
 *
 * Also read by the layout, which needs nothing from it but `tracked`: a map we
 * have never recorded has no tab. The two calls are one request.
 */
export async function loadMapHistory(
  region: Region,
  slug: string,
): Promise<MapHistoryData> {
  return buildSafe(
    () => unicum.region(region).maps(slug).history(),
    null,
  ) as Promise<MapHistoryData>;
}

/** The community's verdict, for the Community tab. */
export async function loadMapRatings(
  region: Region,
  slug: string,
): Promise<MapRatingSummary> {
  return buildSafe(
    () => unicum.region(region).maps(slug).ratings(),
    EMPTY_MAP_RATING_SUMMARY,
  ) as Promise<MapRatingSummary>;
}

/**
 * One mode of the map's recorded battles. Null when the endpoint could not be
 * read: the tab is then absent rather than drawn on figures that are missing.
 *
 * The layout asks for the default mode with the same arguments the tab does,
 * so Next serves both from one request within a render pass.
 */
function askMapStatistics(
  region: Region,
  slug: string,
  mode: LoadoutMode,
  locale: string,
): Promise<MapStatisticsPayload | null> {
  return buildSafe(
    () =>
      unicum
        .region(region)
        .maps(slug)
        .statistics({ mode, language: locale })
        .then((r) => r as unknown as MapStatisticsPayload),
    null,
  );
}

/** The default mode, which carries every mode's sample: what the layout reads
 * to decide whether this map has a Statistics tab and what number it wears. */
export function loadMapStatisticsSummary(
  region: Region,
  slug: string,
  locale: string,
): Promise<MapStatisticsPayload | null> {
  return askMapStatistics(region, slug, LoadoutMode.Random, locale);
}

/** Every mode that holds battles on this map, for the Statistics tab. */
export async function loadMapStatistics(
  region: Region,
  slug: string,
  locale: string,
): Promise<MapStatisticsModeView[]> {
  const first = await loadMapStatisticsSummary(region, slug, locale);
  if (!first) return [];
  const held = new Set(
    first.modes.filter((entry) => entry.battles > 0).map((entry) => entry.mode),
  );
  const views = await Promise.all(
    LOADOUT_MODES.filter((mode) => held.has(mode)).map(async (mode) => ({
      mode,
      stats:
        mode === LoadoutMode.Random
          ? first
          : await askMapStatistics(region, slug, mode, locale),
    })),
  );
  return views.filter(
    (view): view is MapStatisticsModeView => view.stats !== null,
  );
}

/** Battles recorded on the map across every counted mode. */
export function mapStatisticsBattles(
  statistics: MapStatisticsPayload | null,
): number {
  return (statistics?.modes ?? []).reduce((n, entry) => n + entry.battles, 0);
}

/**
 * The tabs this map has something to show for.
 *
 * Tactics and Community are always there, even empty, because that is where
 * their submission form and their rating form live: a tab that appears only
 * once somebody has contributed is a tab nobody can contribute from. History is
 * the one that comes and goes, since a map we have never recorded a version of
 * has nothing to put under it, and an empty changes tab says something false
 * (that the map has never been touched) rather than nothing.
 *
 * Statistics comes and goes the same way: with no recorded battle in the
 * window there is no figure to draw, and an empty tab would only say that
 * nobody running the mod played there lately, which is no fact about the map.
 */
export function availableMapTabs(
  history: MapHistoryData,
  statistics: MapStatisticsPayload | null,
): MapDetailTab[] {
  return [
    MapDetailTab.Videos,
    ...(mapStatisticsBattles(statistics) > 0 ? [MapDetailTab.Statistics] : []),
    MapDetailTab.Community,
    ...(history?.tracked ? [MapDetailTab.History] : []),
  ];
}

/**
 * How much each tab holds, for the number beside its name.
 *
 * Every one of these counts what its tab actually SHOWS, which took a
 * correction worth keeping: the videos count is DISTINCT VIDEOS, not rows,
 * because the endpoint answers one row per battle and a recording holding three
 * battles on this map is one video and one card. It covers both of the tab's
 * lists, the tactics and the random battles below them, which is what the tab
 * is named for and what adds up to the two section headings a reader finds
 * under the bar.
 *
 * Changes counts the rows a reader will actually find there, which includes the
 * ones a running Common Test is about to ship: those are on the tab, under
 * their own heading, and a count that excluded them would be smaller than what
 * the page shows.
 *
 * Statistics counts the battles recorded across every mode, which is what the
 * tab's own mode switch adds up to.
 *
 * Votes come off the detail payload rather than the ratings endpoint. The bar
 * renders on every tab of every map, and asking for the full verdict to print
 * one number is the second SSR self-fetch the vehicle layout refuses for the
 * same reason. Defaulted rather than assumed: that payload is cached for an
 * hour and served by an API that can be one deploy behind this render, so a
 * field this young has to be allowed to be missing.
 */
export function mapTabCounts(
  detail: MapDetailPayload,
  videos: TankVideoCardData[],
  history: MapHistoryData,
  statistics: MapStatisticsPayload | null,
): Partial<Record<MapDetailTab, number>> {
  const changes =
    (history?.versions ?? []).reduce((n, v) => n + v.changes.length, 0) +
    (history?.testChanges.length ?? 0);
  return {
    [MapDetailTab.Videos]: new Set(videos.map((v) => v.videoId)).size,
    [MapDetailTab.Statistics]: mapStatisticsBattles(statistics),
    [MapDetailTab.Community]: detail.rating?.votes ?? 0,
    [MapDetailTab.History]: changes,
  };
}
