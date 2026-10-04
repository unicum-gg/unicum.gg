import { revalidatePath } from "next/cache";
import { APP_IDENTITY, env } from "@unicum.gg/shared";
import { ReviewDecision } from "@unicum.gg/core/community/review-decision";
import { reviewTankRating } from "@unicum.gg/core/tanks/ratings-moderation";
import { notifyRatingAuthor } from "@unicum.gg/core/tanks/rating-author-notice";
import { getTanksByIds } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { REGIONS } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";

export const dynamic = "force-dynamic";

/**
 * Settle a queued written opinion. Called by the Discord bot when a moderator
 * presses Publish or Reject, never by a browser: the gateway process is the only
 * thing that sees those presses, and it has no database of its own.
 *
 * Not `@openapi`-tagged on purpose, so it stays out of the public document and
 * the SDK. Authorised by `CRON_SECRET`, the same shared secret the cron routes
 * and the video review use: the bot and the web are both our own services on the
 * same private network, and the moderator's identity is already established by
 * Discord having delivered the interaction.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    approved?: boolean;
    moderatorId?: string;
    digest?: string;
  } | null;
  if (typeof body?.approved !== "boolean" || !body.moderatorId || !body.digest) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const reviewed = await reviewTankRating(
    id,
    body.approved,
    body.moderatorId,
    body.digest,
  );
  // Two ways to settle nothing, and the bot says something different for each:
  // somebody pressed first, or the author rewrote the text after this card was
  // posted, in which case a newer card carries what they wrote.
  if (reviewed.decision !== ReviewDecision.Settled) {
    return Response.json({ error: reviewed.decision }, { status: 409 });
  }

  // Resolved from the catalogue rather than carried on the card: the press may
  // land weeks after it was posted, and this is the one place both the slug and
  // the vehicle's name are needed, the first to drop the pages and the second
  // to name the tank in the author's notice. A vehicle that has left the
  // catalogue resolves to neither, which is why nothing below assumes one.
  const [tank] = await getTanksByIds(REGIONS[0], [reviewed.tankId!]).catch(
    () => [],
  );
  // Tanks are the same on every region and the votes are global, so all three
  // copies of the page carry the review and all three are dropped. Done on a
  // rejection too: the tab is cached and a review pulled down has to actually
  // disappear from it.
  if (tank) {
    for (const region of REGIONS) {
      revalidatePath(`${ROUTES.TANK(region, tank.slug)}/community`);
      revalidatePath(ROUTES.TANK(region, tank.slug));
    }
  }

  // The Community tab, which is where a published opinion now shows and where a
  // rejected one is rewritten, so both verdicts can point at it.
  const communityUrl = tank
    ? `${APP_IDENTITY.URL}${ROUTES.TANK(REGIONS[0], tank.slug)}/community`
    : null;

  // Told after the decision is recorded and the pages are dropped, so a notice
  // never describes a state the site has not reached. Awaited rather than fired
  // off, since the route dies with the response, but its own failures are
  // swallowed: an author who cannot be reached must not fail a review.
  await notifyRatingAuthor({
    userId: reviewed.userId ?? null,
    tankName: tank?.name ?? null,
    review: reviewed.review ?? null,
    approved: body.approved,
    url: communityUrl,
  });

  return Response.json({
    status: reviewed.status,
    nickname: reviewed.nickname,
    url: body.approved ? communityUrl : null,
  });
}
