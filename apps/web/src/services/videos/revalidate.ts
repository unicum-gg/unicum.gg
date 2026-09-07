import { revalidatePath } from "next/cache";
import { APP_IDENTITY } from "@unicum.gg/shared";
import { getClanTagById } from "@unicum.gg/core/clans/repository";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { getTankSlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { isRegion, REGIONS } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";

/**
 * Dropping the pages a community video shows on.
 *
 * They are cached, so a video that changed state would otherwise wait out the
 * revalidation window: approved and invisible for half an hour, or corrected
 * and still showing the tank it was moved off. Shared between approving one and
 * editing one, because an edit is two of these: the placement it left and the
 * one it landed on.
 */

/** Everywhere one row is published. A tactic has no tank, and a video credited
 * to nobody has no clan. */
export type VideoPlacement = {
  tankId: number | null;
  arenaId: string | null;
  clanRegion: string | null;
  clanId: number | null;
};

/**
 * Drop every page this placement appears on, and answer with the public link to
 * where the video shows.
 *
 * Tanks and maps are the same on every region and the videos are global, so all
 * three regions carry it and all three are dropped. A clan exists on one region
 * only, and its tag is resolved from the stored id so a rename since the
 * submission still drops the page it is on today.
 */
export async function revalidateVideoPlacement(
  placement: VideoPlacement,
): Promise<string | null> {
  const { tankSlug, mapSlug } = await resolvePlacement(placement);

  for (const region of REGIONS) {
    if (tankSlug) {
      revalidatePath(ROUTES.TANK(region, tankSlug));
      revalidatePath(`${ROUTES.TANK(region, tankSlug)}/videos`);
    }
    if (mapSlug) revalidatePath(ROUTES.MAP(region, mapSlug));
  }

  const clanRegion = placement.clanRegion;
  if (clanRegion && isRegion(clanRegion) && placement.clanId !== null) {
    const clanTag = await getClanTagById(clanRegion, placement.clanId).catch(
      () => null,
    );
    if (clanTag) {
      // Both, like the tank above: the tab renders the list, and the profile it
      // hangs off seeds the "Videos (N)" the nav reads on first paint.
      revalidatePath(ROUTES.CLAN(clanRegion, clanTag));
      revalidatePath(`${ROUTES.CLAN(clanRegion, clanTag)}/videos`);
    }
  }

  return publicUrl(tankSlug, mapSlug);
}

/**
 * Drop the pages of a video that moved, from where it left and where it landed.
 *
 * The two are usually the same place: most corrections fix a timestamp or an
 * outcome and leave the video exactly where it was. Doing the identical work
 * twice for those is three slug resolutions and six `revalidatePath` calls
 * nobody needed, so the second pass is skipped when nothing moved.
 */
export async function revalidateVideoMove(
  before: VideoPlacement,
  after: VideoPlacement,
): Promise<string | null> {
  const moved =
    before.tankId !== after.tankId ||
    before.arenaId !== after.arenaId ||
    before.clanRegion !== after.clanRegion ||
    before.clanId !== after.clanId;
  if (!moved) return revalidateVideoPlacement(after);
  // The one it left first: that is the page someone is most likely looking at.
  await revalidateVideoPlacement(before);
  return revalidateVideoPlacement(after);
}

/** The tank and map a placement points at, resolved once. */
async function resolvePlacement(placement: VideoPlacement): Promise<{
  tankSlug: string | null;
  mapSlug: string | null;
}> {
  const [tankSlug, map] = await Promise.all([
    placement.tankId === null
      ? null
      : getTankSlug(REGIONS[0], placement.tankId).catch(() => null),
    // A tactic has no tank page to drop, which is the whole reason the map page
    // exists for it.
    placement.arenaId
      ? getMapDetailBySlug(REGIONS[0], placement.arenaId).catch(() => null)
      : null,
  ]);
  return { tankSlug, mapSlug: map?.slug ?? null };
}

/**
 * The page one row shows on, without dropping any cache.
 *
 * Same rule as the revalidation above, and the same rule the moderation link
 * needs: a correction opens its dialog on the page the video lives on, which is
 * the tank's for a random battle and the map's for a tactic.
 */
export async function videoPageUrl(
  placement: VideoPlacement,
): Promise<string | null> {
  const { tankSlug, mapSlug } = await resolvePlacement(placement);
  return publicUrl(tankSlug, mapSlug);
}

/** A random battle on a known tank lives on the tank page; a tactic only has
 * the map page. EU stands in for the canonical origin, the pages being
 * identical across regions. */
function publicUrl(tankSlug: string | null, mapSlug: string | null): string | null {
  if (tankSlug) {
    return `${APP_IDENTITY.URL}${ROUTES.TANK(REGIONS[0], tankSlug)}/videos`;
  }
  if (mapSlug) return `${APP_IDENTITY.URL}${ROUTES.MAP(REGIONS[0], mapSlug)}`;
  return null;
}
