import { env } from "@unicum.gg/shared";
import { reviewTankVideo } from "@unicum.gg/core/tanks/videos";
import { notifyVideoAuthor } from "@unicum.gg/core/tanks/video-author-notice";
import { revalidateVideoPlacement } from "@/services/videos/revalidate";

export const dynamic = "force-dynamic";

/**
 * Settle a queued video suggestion. Called by the Discord bot when a moderator
 * presses Approve or Reject, never by a browser: the gateway process is the only
 * thing that sees those presses, and it has no database of its own.
 *
 * Not `@openapi`-tagged on purpose, so it stays out of the public document and
 * the SDK. Authorised by `CRON_SECRET`, the same shared secret the cron routes
 * use: the bot and the web are both our own services on the same private
 * network, and the moderator's identity is already established by Discord.
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
    /** Why it was turned down, typed into the modal the Reject button opens. */
    note?: string;
  } | null;
  if (typeof body?.approved !== "boolean" || !body.moderatorId) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const reviewed = await reviewTankVideo(
    id,
    body.approved,
    body.moderatorId,
    body.note,
  );
  // Null means unknown, or already settled by whoever pressed first. Not an
  // error: the bot turns it into "already handled" on the card.
  if (!reviewed) {
    return Response.json({ error: "already_reviewed" }, { status: 409 });
  }

  // A public link back to where the video now shows, handed to the bot so its
  // approval reply can point straight at it. Only on an approval: a rejection
  // publishes nothing, so there is no page to drop and nowhere to point.
  const url = body.approved ? await revalidateVideoPlacement(reviewed) : null;

  // Told after the decision is recorded and the pages are dropped, so a notice
  // never describes a state the site has not reached. Awaited rather than
  // fired off, since the route dies with the response, but its own failures are
  // swallowed: a submitter who cannot be reached must not fail a review.
  await notifyVideoAuthor({
    userId: reviewed.submittedBy,
    title: reviewed.title,
    videoId: reviewed.videoId,
    approved: body.approved,
    url,
    note: body.note,
  });

  return Response.json({ status: reviewed.status, title: reviewed.title, url });
}
