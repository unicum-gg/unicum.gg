import { headers } from "next/headers";
import { auth } from "@unicum.gg/core/auth";
import { reviewsEnabled } from "@unicum.gg/core/community/reviews-open";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { getMapRatingEligibility } from "@unicum.gg/core/maps/ratings-eligibility";
import { getOwnMapRating } from "@unicum.gg/core/maps/ratings-board";
import { MAP_MIN_BATTLES_TO_RATE, MapRatingAxis } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { MapRatingMeResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * My rating of this map
 * @description Whether the caller may rate this map, on what evidence, and what they already said about it. The gate is the honest part: the vehicle ratings read the caller's record on that exact tank, and nothing can do the same for an arena, because Wargaming publishes no per-arena record for anybody. So this answers with the caller's own account record, how many battles are still missing when they are short, and their existing vote if there is one (including a written opinion still waiting on a moderator, which only its author is shown). Signed out is not an error: it answers `signedIn: false` so the page can offer the sign-in rather than break. The rating is made under the caller's own Wargaming region, whatever region the page was opened on.
 * @pathParams mapParams
 * @response MapRatingMeResponse
 * @tag Maps
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const map = await getMapDetailBySlug(region, decodeURIComponent(slug));
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });

  const reviewsOpen = reviewsEnabled();
  // Never cached, in any layer: this is one reader's own state, and a shared
  // cache holding it would hand one player's vote to the next visitor.
  const noStore = { headers: { "cache-control": "private, no-store" } };

  const session = await auth.api.getSession({ headers: await headers() });
  const wg = wgIdentityFromEmail(session?.user?.email);
  if (!session?.user || !wg) {
    return jsonResponse(
      MapRatingMeResponse,
      {
        signedIn: false,
        votingRegion: null,
        eligible: false,
        block: null,
        required: MAP_MIN_BATTLES_TO_RATE,
        player: null,
        rating: null,
        reviewsOpen,
      },
      noStore,
    );
  }

  // The voter's own region, not the page's: someone signed in on EU browsing
  // the NA copy of a map page is still an EU player, and their record lives in
  // the EU tables.
  const [eligibility, own] = await Promise.all([
    getMapRatingEligibility(wg.region, wg.accountId),
    getOwnMapRating(map.arenaId, session.user.id),
  ]);

  return jsonResponse(
    MapRatingMeResponse,
    {
      signedIn: true,
      // Never the region in the path: an NA player opening the EU copy of a map
      // page is still an NA player, and a refusal screen that names the wrong
      // server explains nothing.
      votingRegion: wg.region,
      eligible: eligibility.eligible,
      block: eligibility.block,
      required: eligibility.required,
      player: eligibility.player,
      rating: own && {
        overall: own.overall,
        fun: own.fun,
        axes: Object.entries(own.detail).map(([axis, value]) => ({
          axis: axis as MapRatingAxis,
          value,
        })),
        review: own.review,
        reviewStatus: own.reviewStatus,
        gameVersion: own.gameVersion,
        updatedAt: own.updatedAt,
      },
      reviewsOpen,
    },
    noStore,
  );
}
