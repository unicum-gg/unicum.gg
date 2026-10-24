import { UnicumError } from "@unicum.gg/sdk";
import {
  LoadoutMode,
  LOADOUT_MODES,
  type TankRatingSummary,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import type {
  TankLoadoutModeView,
  TankLoadoutsPayload,
} from "@/components/tanks/detail/loadouts/view";
import type { SimilarTankRow } from "@/app/api/[region]/tanks/[slug]/similar/schema.api";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import { buildSafe, unicum } from "@/services/sdk";

// The page consumes its own public API through the SDK: one composite
// `GET /{region}/tanks/{slug}/detail` payload carries everything the layout and
// its tabs render. Next memoizes identical fetches within one render pass, so
// the layout, the page and generateMetadata share a single request.
export async function loadTankDetail(region: Region, slug: string) {
  try {
    return await unicum.region(region).tanks(slug).detail();
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

export type TankDetail = NonNullable<
  Awaited<ReturnType<typeof loadTankDetail>>
>;

/**
 * A tank's characteristics change history (buffs/nerfs across game versions),
 * for the History tab. Fetched separately from the detail payload, like the
 * videos: the tab reads it on its own segment, so a tank with no history costs
 * the detail payload nothing.
 */
export async function loadTankHistory(region: Region, slug: string) {
  return unicum
    .region(region)
    .tanks(slug)
    .history()
    .then((r) => ({
      versions: r.versions,
      testVersion: r.testVersion,
      testChanges: r.testChanges,
      devVersion: r.devVersion,
      devAt: r.devAt,
      releasedVersion: r.releasedVersion,
      releasedAt: r.releasedAt,
    }))
    .catch(() => ({
      versions: [],
      testVersion: null,
      testChanges: [],
      devVersion: null,
      devAt: null as Date | null,
      releasedVersion: null,
      releasedAt: null as Date | null,
    }));
}

export type TankHistoryData = Awaited<ReturnType<typeof loadTankHistory>>;
export type TankHistoryVersions = TankHistoryData["versions"];

/**
 * The approved videos of a tank, for the hero player and the lists that feed it.
 *
 * The map catalogue the submission form needs is not fetched with them: the
 * form pulls it itself when it opens, so no tank page carries 23 KB of maps for
 * a dialog almost nobody opens.
 */
export async function loadTankVideos(
  region: Region,
  slug: string,
): Promise<TankVideoCardData[]> {
  return unicum
    .region(region)
    .tanks(slug)
    .videos()
    .then((r) => r.videos as unknown as TankVideoCardData[])
    .catch(() => []);
}

/**
 * The vehicles that play like this one, for the foot of the Specifications tab.
 *
 * Its own request rather than a field of the detail payload: that payload is
 * cached under a shape version, and these are wanted on one tab out of six, by
 * the tank list and by anything else that later asks.
 *
 * `buildSafe`, not a bare catch, for the reason spelled out on the ratings
 * loader below: this page is ISR, so one timed-out revalidation swallowed here
 * would bake a Specifications tab with no Similar section, and none of the six
 * internal links it carries, into the cache for half an hour and serve it to
 * crawlers. Silencing belongs to the build, where there may be no API to ask;
 * at runtime a failure has to propagate so the last good page is kept.
 */
export async function loadSimilarTanks(
  region: Region,
  slug: string,
): Promise<SimilarTankRow[]> {
  return buildSafe(
    () =>
      unicum
        .region(region)
        .tanks(slug)
        .similar()
        .then((r) => r.results as unknown as SimilarTankRow[]),
    [],
  );
}

/**
 * The community's verdict on a tank, for the Community tab.
 *
 * Fetched on its own segment like the videos and the history, so a tank nobody
 * has rated costs the other tabs nothing. The hero badge does not use this: it
 * reads the three figures the detail payload already carries.
 *
 * `buildSafe`, not a bare catch. A catch here would swallow a runtime failure
 * too, and this page is ISR: one timed-out revalidation would bake "nobody has
 * rated this tank" into the cache for half an hour on a vehicle with four
 * hundred votes, and drop its aggregateRating out of the markup Googlebot
 * reads. Failing instead keeps the last good page, which is the whole reason
 * `buildSafe` only silences the build.
 */
export async function loadTankRatings(
  region: Region,
  slug: string,
): Promise<TankRatingSummary> {
  return buildSafe(async () => {
    try {
      const summary = await unicum.region(region).tanks(slug).ratings();
      return summary as unknown as TankRatingSummary;
    } catch (error) {
      // A slug the catalogue does not know is not a ratings failure. The tab
      // resolves the vehicle through `loadTankTab`, and that is what calls
      // `notFound()`. Both run inside one `Promise.all`, so letting the 404
      // out of here means it rejects the pair before the resolve can answer,
      // and a missing tank renders as a 500 on the Community tab while every
      // other tab correctly 404s.
      if (error instanceof UnicumError && error.status === 404) {
        return EMPTY_RATING_SUMMARY;
      }
      throw error;
    }
  }, EMPTY_RATING_SUMMARY);
}

const EMPTY_RATING_SUMMARY: TankRatingSummary = {
  tankId: 0,
  votes: 0,
  overall: null,
  fun: null,
  overallBayes: null,
  funBayes: null,
  overallStddev: null,
  consensus: null,
  overallDistribution: [],
  funDistribution: [],
  brackets: [],
  regions: [],
  axes: [],
  axisVotes: 0,
  avgVoterBattles: null,
  hype: null,
  perceivedPercentile: null,
  measuredPercentile: null,
  reviews: [],
  reviewCount: 0,
};

/**
 * Which tabs have something to show for this tank, read from the payload rather
 * than from rendered content, so an unavailable tab costs nothing.
 *
 * Computed in the layout, which is what draws the tab bar, and read again by
 * each tab to know whether it is one of them.
 */
export function availableTabs(detail: TankDetail): TankDetailTab[] {
  const hasSpecifications =
    Boolean(detail.specs) ||
    (detail.researchPath?.lineage.length ?? 0) > 0 ||
    detail.modules.length > 0;
  const hasMarks = Boolean(detail.moe || detail.mom);
  const hasHistory = detail.hasHistory;
  return [
    ...(hasSpecifications ? [TankDetailTab.Specifications] : []),
    TankDetailTab.Performances,
    // Always offered, and deliberately not read off the detail payload. That
    // payload is cached under a shape version, so adding a loadout count to it
    // would crash every cache hit until the old shape expired; and an empty
    // Loadouts tab is where the mod that fills it gets explained, so hiding it
    // on the vehicles with nothing would hide it from exactly the readers who
    // could change that.
    TankDetailTab.Loadouts,
    ...(hasMarks ? [TankDetailTab.Marks] : []),
    ...(hasHistory ? [TankDetailTab.History] : []),
    // Always offered, unlike the others, which hide when the payload has
    // nothing for them. An empty Videos tab is where the suggestion form lives,
    // so hiding it would make the first submission for a tank impossible.
    TankDetailTab.Videos,
    // Same rule, same reason: an unrated tank is exactly the one whose page has
    // to offer the form, or no vehicle could ever get its first vote.
    TankDetailTab.Community,
  ];
}

/**
 * What this vehicle's players fit to it in battle, for the Loadouts tab: every
 * battle mode that holds anything.
 *
 * Asked for per mode, because the tab ships them all and lets the reader
 * switch without a round trip. That is forced rather than chosen:
 * the catalogues naming each device and perk in the reader's language never
 * reach the browser, so a client-side refetch would come back as a list of
 * client keys nobody could read. The first answer carries every mode's sample,
 * so only the modes with players are asked for at all, which on most vehicles
 * today is none or one.
 *
 * `buildSafe`, not a bare catch, for the reason the ratings loader gives: this
 * page is ISR, so a runtime failure has to propagate or one timed-out
 * revalidation bakes an empty tab into the cache for half an hour on a vehicle
 * that has plenty.
 */
export async function loadTankLoadouts(
  region: Region,
  slug: string,
  /** Names the fitted items of the best battles, which the endpoint draws. */
  locale: string,
): Promise<TankLoadoutModeView[]> {
  return buildSafe(async () => {
    const ask = (mode: LoadoutMode) =>
      unicum
        .region(region)
        .tanks(slug)
        .loadouts({ mode, language: locale })
        .then((r) => r as unknown as TankLoadoutsPayload)
        // A slug the catalogue does not know is not a loadout failure: the tab
        // resolves the vehicle through `loadTankTab`, which is what calls
        // `notFound()`. Both run together, so letting the 404 out of here
        // rejects the pair before the resolve can answer and a missing tank
        // renders as a 500 on this tab alone.
        .catch((error) => {
          if (error instanceof UnicumError && error.status === 404) return null;
          throw error;
        });

    const first = await ask(LoadoutMode.Random);
    if (!first) return [];
    const held = new Set(
      first.modes.filter((entry) => entry.players > 0).map((entry) => entry.mode),
    );
    const modes = LOADOUT_MODES.filter((mode) => held.has(mode));

    const views = await Promise.all(
      modes.map(async (mode) => ({
        mode,
        stats: mode === LoadoutMode.Random ? first : await ask(mode),
      })),
    );
    return views.filter(
      (view): view is TankLoadoutModeView => view.stats !== null,
    );
  }, []);
}
