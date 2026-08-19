import { UnicumError } from "@unicum.gg/sdk";
import type { Region } from "@unicum.gg/wargaming";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import { unicum } from "@/services/sdk";

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
      devVersion: r.devVersion,
      devAt: r.devAt,
      releasedVersion: r.releasedVersion,
      releasedAt: r.releasedAt,
    }))
    .catch(() => ({
      versions: [],
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
    ...(hasMarks ? [TankDetailTab.Marks] : []),
    ...(hasHistory ? [TankDetailTab.History] : []),
    // Always offered, unlike the others, which hide when the payload has
    // nothing for them. An empty Videos tab is where the suggestion form lives,
    // so hiding it would make the first submission for a tank impossible.
    TankDetailTab.Videos,
  ];
}
