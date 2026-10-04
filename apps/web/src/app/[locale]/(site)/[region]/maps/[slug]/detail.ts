import { UnicumError } from "@unicum.gg/sdk";
import type { MapDetail, MapRatingSummary } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { MapDetailTab } from "@/components/maps/detail/tabs";
import type { MapHistoryData } from "@/components/maps/detail/history/data";
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
    return (await unicum
      .region(region)
      .maps(slug)
      .detail()) as unknown as MapDetailPayload;
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
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
 * The tabs this map has something to show for.
 *
 * Tactics and Community are always there, even empty, because that is where
 * their submission form and their rating form live: a tab that appears only
 * once somebody has contributed is a tab nobody can contribute from. History is
 * the one that comes and goes, since a map we have never recorded a version of
 * has nothing to put under it, and an empty changes tab says something false
 * (that the map has never been touched) rather than nothing.
 */
export function availableMapTabs(history: MapHistoryData): MapDetailTab[] {
  return [
    MapDetailTab.Videos,
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
): Partial<Record<MapDetailTab, number>> {
  const changes =
    (history?.versions ?? []).reduce((n, v) => n + v.changes.length, 0) +
    (history?.testChanges.length ?? 0);
  return {
    [MapDetailTab.Videos]: new Set(videos.map((v) => v.videoId)).size,
    [MapDetailTab.Community]: detail.rating?.votes ?? 0,
    [MapDetailTab.History]: changes,
  };
}
