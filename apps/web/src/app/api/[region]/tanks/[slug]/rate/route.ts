import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@unicum.gg/core/auth";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import {
  submitTankRating,
  SubmitRatingOutcome,
} from "@unicum.gg/core/tanks/ratings";
import {
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  ReviewOutcome,
  TankRatingAxis,
} from "@unicum.gg/shared";
import { isRegion, REGIONS } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import ROUTES from "@/constants/routes";
import { TankRateBody, TankRateResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * A sliding window per account, because every changed review posts a card into
 * a Discord channel a human reads.
 *
 * Nothing in the database signals abuse here: the upsert keeps one row per
 * account and tank however many times it is called, so a loop that rewrites its
 * text produces an unbounded stream of moderation cards and one tidy row. The
 * limit is per user rather than per IP, since the endpoint already requires a
 * signed-in Wargaming account and that is the thing being rate limited.
 *
 * Best-effort and per-instance, like the feedback endpoint's: enough to stop a
 * script, not a distributed-systems guarantee.
 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

/**
 * Rate a tank
 * @description Cast or revise this account's opinion of a vehicle. Requires a signed-in Wargaming account that has actually played the tank: the endpoint reads the caller's own record on it and refuses with 403 below the battle threshold, which is what makes this average worth more than a poll of whoever showed up. One opinion per account per tank, so sending again replaces the previous one rather than adding to it. The evidence the vote rests on (battles, win rate, damage, the account's rating) is copied onto it at the moment it is cast, and the client version is stamped, so an opinion stays attached to the tank it was formed on. A written opinion is queued for moderation and never published here; the stars count immediately. The vote is recorded under the caller's own region, whatever region the page was opened on. 401 when signed out, 403 when the record is too thin, 404 for an unknown tank.
 * @pathParams tankParams
 * @body TankRateBody
 * @response TankRateResponse
 * @tag Tanks
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

  if (rateLimited(session.user.id)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = TankRateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = parsed.data;

  const tank = await getTankBySlug(region, decodeURIComponent(slug));
  if (!tank) return Response.json({ error: "not_found" }, { status: 404 });

  const detail: Partial<Record<TankRatingAxis, number>> = {};
  const put = (axis: TankRatingAxis, value: number | null | undefined) => {
    if (value != null) detail[axis] = value;
  };
  put(TankRatingAxis.Firepower, body.firepower);
  put(TankRatingAxis.Armour, body.armour);
  put(TankRatingAxis.Mobility, body.mobility);
  put(TankRatingAxis.GunHandling, body.gunHandling);
  put(TankRatingAxis.Concealment, body.concealment);
  put(TankRatingAxis.BeginnerFriendliness, body.beginnerFriendliness);
  put(TankRatingAxis.Versatility, body.versatility);

  const result = await submitTankRating({
    tankId: tank.tankId,
    tankName: tank.meta.name,
    tankSlug: tank.slug,
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
    case SubmitRatingOutcome.Saved:
      // The community tab is served from cache, so a vote would otherwise wait
      // out the revalidation window before showing in its own histogram. Tanks
      // are the same on every region and the votes are global, so all three
      // copies of the page are dropped.
      for (const r of REGIONS) {
        revalidatePath(`${ROUTES.TANK(r, tank.slug)}/community`);
        revalidatePath(ROUTES.TANK(r, tank.slug));
      }
      return jsonResponse(
        TankRateResponse,
        { ok: true, review: result.review ?? ReviewOutcome.None },
        { headers: { "cache-control": "no-store" } },
      );
    case SubmitRatingOutcome.ReviewLength:
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
    case SubmitRatingOutcome.NotEligible:
      return Response.json(
        {
          error: "not_eligible",
          block: result.eligibility?.block ?? null,
          required: result.eligibility?.required ?? 0,
          battles: result.eligibility?.record?.battles ?? null,
        },
        { status: 403 },
      );
    default:
      return Response.json({ error: "invalid_body" }, { status: 400 });
  }
}
