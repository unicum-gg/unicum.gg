import { headers } from "next/headers";
import { auth } from "@unicum.gg/core/auth";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { tankReviewsEnabled } from "@unicum.gg/core/tanks/ratings";
import { getRatingEligibility } from "@unicum.gg/core/tanks/ratings-eligibility";
import { getOwnTankRating } from "@unicum.gg/core/tanks/ratings-board";
import { MIN_BATTLES_TO_RATE, TankRatingAxis } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { TankRatingMeResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * My rating of this tank
 * @description Whether the caller may rate this vehicle, on what evidence, and what they already said about it. The gate is the point: an account has to have taken the tank into battle before its opinion counts, so this answers with their own record on it, how many battles are still missing when they are short, and their existing vote if there is one (including a written opinion still waiting on a moderator, which only its author is shown). Signed out is not an error: it answers `signedIn: false` so the page can offer the sign-in rather than break. The rating is made under the caller's own Wargaming region, whatever region the page was opened on.
 * @pathParams tankParams
 * @response TankRatingMeResponse
 * @tag Tanks
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
  const tank = await getTankBySlug(region, decodeURIComponent(slug));
  if (!tank) return Response.json({ error: "not_found" }, { status: 404 });

  const reviewsOpen = tankReviewsEnabled();
  // Never cached, in any layer: this is one reader's own state, and a shared
  // cache holding it would hand one player's vote to the next visitor.
  const noStore = { headers: { "cache-control": "private, no-store" } };

  const session = await auth.api.getSession({ headers: await headers() });
  const wg = wgIdentityFromEmail(session?.user?.email);
  if (!session?.user || !wg) {
    return jsonResponse(
      TankRatingMeResponse,
      {
        signedIn: false,
        votingRegion: null,
        eligible: false,
        block: null,
        required: MIN_BATTLES_TO_RATE,
        record: null,
        player: null,
        rating: null,
        reviewsOpen,
      },
      noStore,
    );
  }

  // The voter's own region, not the page's: someone signed in on EU browsing
  // the NA copy of a tank page is still an EU player, and their record lives in
  // the EU tables.
  const [eligibility, own] = await Promise.all([
    getRatingEligibility(wg.region, wg.accountId, tank.tankId),
    getOwnTankRating(tank.tankId, session.user.id),
  ]);

  return jsonResponse(
    TankRatingMeResponse,
    {
      signedIn: true,
      // The caller's own server, which is where their record was read and where
      // their vote will be counted. Never the region in the path: an NA player
      // opening the EU copy of a tank page is still an NA player, and a refusal
      // screen that names the wrong server explains nothing.
      votingRegion: wg.region,
      eligible: eligibility.eligible,
      block: eligibility.block,
      required: eligibility.required,
      record: eligibility.record,
      player: eligibility.player,
      rating: own && {
        overall: own.overall,
        fun: own.fun,
        axes: Object.entries(own.detail).map(([axis, value]) => ({
          axis: axis as TankRatingAxis,
          value,
        })),
        review: own.review,
        reviewStatus: own.reviewStatus,
        battles: own.battles,
        gameVersion: own.gameVersion,
        updatedAt: own.updatedAt,
      },
      reviewsOpen,
    },
    noStore,
  );
}
