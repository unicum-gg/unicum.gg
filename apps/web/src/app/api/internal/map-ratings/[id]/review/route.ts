import { revalidatePath } from "next/cache";
import { APP_IDENTITY, env } from "@unicum.gg/shared";
import { ReviewDecision } from "@unicum.gg/core/community/review-decision";
import { reviewMapRating } from "@unicum.gg/core/maps/ratings-moderation";
import { notifyMapRatingAuthor } from "@unicum.gg/core/maps/rating-author-notice";
import { resolveArenaRefs } from "@unicum.gg/core/wargaming/wot/maps";
import { REGIONS } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";

export const dynamic = "force-dynamic";

/**
 * Settle a queued written opinion about a map. Called by the Discord bot when a
 * moderator presses Publish or Reject, never by a browser: the gateway process
 * is the only thing that sees those presses, and it has no database of its own.
 *
 * Not `@openapi`-tagged on purpose, so it stays out of the public document and
 * the SDK. Authorised by `CRON_SECRET`, the same shared secret the cron routes
 * and the other two queues use: the bot and the web are both our own services
 * on the same private network, and the moderator's identity is already
 * established by Discord having delivered the interaction.
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

  const reviewed = await reviewMapRating(
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
  // the map's name are needed, the first to drop the pages and the second to
  // name the map in the author's notice. An arena that has left the catalogue
  // resolves to neither, which is why nothing below assumes one.
  //
  // `resolveArenaRefs` rather than a hand-rolled index lookup: it is already the
  // reader that turns an arena id into the map that answers for it, and a vote
  // always carries a base arena id (a map's variants share its page and its
  // verdict).
  const refs = await resolveArenaRefs(REGIONS[0], [reviewed.arenaId!]).catch(
    () => new Map<string, { slug: string; name: string }>(),
  );
  const map = refs.get(reviewed.arenaId!) ?? null;
  // An arena is the same arena on every region and the votes are global, so all
  // three copies of the page carry the review and all three are dropped. Done
  // on a rejection too: the page is ISR and a review pulled down has to
  // actually disappear from it.
  if (map) {
    for (const region of REGIONS) {
      revalidatePath(`${ROUTES.MAP(region, map.slug)}/community`);
    }
  }

  // The Community tab, which is both where a published opinion now shows and
  // where a rejected one is rewritten.
  const mapUrl = map
    ? `${APP_IDENTITY.URL}${ROUTES.MAP(REGIONS[0], map.slug)}/community`
    : null;

  // Told after the decision is recorded and the pages are dropped, so a notice
  // never describes a state the site has not reached. Awaited rather than fired
  // off, since the route dies with the response, but its own failures are
  // swallowed: an author who cannot be reached must not fail a review.
  await notifyMapRatingAuthor({
    userId: reviewed.userId ?? null,
    mapName: map?.name ?? null,
    review: reviewed.review ?? null,
    approved: body.approved,
    url: mapUrl,
  });

  return Response.json({
    status: reviewed.status,
    nickname: reviewed.nickname,
    url: body.approved ? mapUrl : null,
  });
}
