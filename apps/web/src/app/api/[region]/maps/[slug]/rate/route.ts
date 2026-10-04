import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@unicum.gg/core/auth";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import {
  submitMapRating,
  SubmitMapRatingOutcome,
} from "@unicum.gg/core/maps/ratings";
import {
  MapRatingAxis,
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  ReviewOutcome,
} from "@unicum.gg/shared";
import { isRegion, REGIONS } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import {
  createRateLimiter,
  RATE_LIMIT_WINDOW_MS,
} from "@/services/rate-limit";
import ROUTES from "@/constants/routes";
import { MapRateBody, MapRateResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * A sliding window per account, because every changed review posts a card into
 * a Discord channel a human reads.
 *
 * Nothing in the database signals abuse here: the upsert keeps one row per
 * account and arena however many times it is called, so a loop that rewrites
 * its text produces an unbounded stream of moderation cards and one tidy row.
 * Its own limiter rather than the vehicle route's, so a reader who has just
 * rated six tanks can still say something about the map they are looking at.
 */
const limiter = createRateLimiter({
  limit: 10,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

/**
 * Rate a map
 * @description Cast or revise this account's opinion of a map. Requires a signed-in Wargaming account that has played enough of the game: unlike the vehicle ratings, the gate cannot read a record on the subject, because Wargaming publishes no per-arena record for anybody, so it reads the account's lifetime battle count instead and refuses with 403 below the threshold. The rotation is what makes that fair rather than arbitrary: nobody chooses where they are sent, so exposure follows from playing at all. One opinion per account per map, so sending again replaces the previous one rather than adding to it. The evidence the vote rests on (the account's battles, its trailing 30 days, its win rate and rating) is copied onto it at the moment it is cast, and the client version is stamped, so an opinion stays attached to the layout it was formed on. A written opinion is queued for moderation and never published here; the stars count immediately. The vote is recorded under the caller's own region, whatever region the page was opened on. 401 when signed out, 403 when the record is too thin, 404 for an unknown map.
 * @pathParams mapParams
 * @body MapRateBody
 * @response MapRateResponse
 * @tag Maps
 * @openapi
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const wg = wgIdentityFromEmail(session?.user?.email);
  if (!session?.user || !wg) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (limiter.limited(session.user.id)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = MapRateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = parsed.data;

  const map = await getMapDetailBySlug(region, decodeURIComponent(slug));
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });

  const detail: Partial<Record<MapRatingAxis, number>> = {};
  const put = (axis: MapRatingAxis, value: number | null | undefined) => {
    if (value != null) detail[axis] = value;
  };
  put(MapRatingAxis.Balance, body.balance);
  put(MapRatingAxis.Variety, body.variety);
  put(MapRatingAxis.Flow, body.flow);
  put(MapRatingAxis.ClassFairness, body.classFairness);
  put(MapRatingAxis.BeginnerFriendliness, body.beginnerFriendliness);

  const result = await submitMapRating({
    // The arena rather than the slug: a renamed map keeps its id, and the votes
    // have to follow the map rather than the URL.
    arenaId: map.arenaId,
    mapName: map.name,
    mapSlug: map.slug,
    // The voter's own region, not the page's: their record lives there, and so
    // does the server the split will credit their vote to.
    region: wg.region,
    accountId: wg.accountId,
    userId: session.user.id,
    nickname: session.user.name ?? String(wg.accountId),
    overall: body.overall,
    fun: body.fun,
    detail,
    // Passed through exactly as it arrived. `undefined` (the field absent)
    // means "leave the text alone" and `null` means "withdraw it", and the
    // difference is the whole contract of an edit: collapsing them here would
    // let a caller sending only new stars destroy a published review.
    review: body.review,
  });

  switch (result.outcome) {
    case SubmitMapRatingOutcome.Saved:
      // The map page is ISR, so a vote would otherwise wait out the
      // revalidation window before showing in its own histogram. An arena is
      // the same arena on every region and the votes are global, so all three
      // copies of the page are dropped.
      for (const r of REGIONS) {
        revalidatePath(`${ROUTES.MAP(r, map.slug)}/community`);
      }
      return jsonResponse(
        MapRateResponse,
        { ok: true, review: result.review ?? ReviewOutcome.None },
        { headers: { "cache-control": "no-store" } },
      );
    case SubmitMapRatingOutcome.ReviewLength:
      // Its own answer rather than a generic invalid body: the form can turn
      // this into "a few more words" and nothing else.
      return Response.json(
        {
          error: "review_length",
          min: MIN_REVIEW_LENGTH,
          max: MAX_REVIEW_LENGTH,
        },
        { status: 400 },
      );
    case SubmitMapRatingOutcome.NotEligible:
      return Response.json(
        {
          error: "not_eligible",
          block: result.eligibility?.block ?? null,
          required: result.eligibility?.required ?? 0,
          battles: result.eligibility?.player?.battles ?? null,
        },
        { status: 403 },
      );
    default:
      return Response.json({ error: "invalid_body" }, { status: 400 });
  }
}
