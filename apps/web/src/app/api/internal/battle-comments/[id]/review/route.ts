import { APP_IDENTITY, env } from "@unicum.gg/shared";
import { ReviewDecision } from "@unicum.gg/core/community/review-decision";
import {
  BattleCommentAction,
  reviewBattleComment,
} from "@unicum.gg/core/battles/comments";

export const dynamic = "force-dynamic";

/**
 * A moderator's press on a battle comment's card, relayed by the bot.
 *
 * Internal like the vehicle and map review endpoints beside it, authenticated
 * by the shared secret: Discord delivering the press is what established the
 * moderator. Publish and Reject settle a waiting comment; Remove takes down one
 * already published, from the same card.
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
    action?: string;
    moderatorId?: string;
    digest?: string;
  } | null;
  // `approved` is what the bot sends for the two first-decision buttons, which
  // it shares with the other queues; `action` names the removal.
  const action =
    body?.action === BattleCommentAction.Remove
      ? BattleCommentAction.Remove
      : body?.approved === true
        ? BattleCommentAction.Approve
        : body?.approved === false
          ? BattleCommentAction.Reject
          : null;
  if (!action || !body?.moderatorId || !body.digest) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const reviewed = await reviewBattleComment(id, action, body.moderatorId, body.digest);
  if (reviewed.decision !== ReviewDecision.Settled) {
    return Response.json({ error: reviewed.decision }, { status: 409 });
  }
  return Response.json({
    action,
    url:
      action === BattleCommentAction.Approve
        ? `${APP_IDENTITY.URL}/${reviewed.region}/battles/${reviewed.arenaUniqueId}?tab=replay`
        : null,
  });
}
