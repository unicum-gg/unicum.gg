import { headers } from "next/headers";
import { isRegion } from "@unicum.gg/wargaming";
import { BattleCommentStatus } from "@unicum.gg/shared";
import { auth } from "@unicum.gg/core/auth";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import {
  submitBattleComment,
  SubmitBattleCommentOutcome,
} from "@unicum.gg/core/battles/comments";
import { reviewsEnabled } from "@unicum.gg/core/community/reviews-open";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { jsonResponse } from "@/services/openapi/json-response";
import { createRateLimiter } from "@/services/rate-limit";
import { BattleCommentBody, BattleCommentResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Each comment is a card a moderator has to read, so what is limited is the
 * stream of cards one account can put in front of them.
 */
const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

/**
 * Comment on a battle
 * @description Write a comment under a battle's replay. Requires a signed-in Wargaming account. The comment is queued for a moderator and shown to nobody but its author until it is published, so the answer is always `pending`. An account may comment as often as it likes on one battle, within ten comments an hour. 401 when signed out, 404 for an unknown battle or when this deployment takes no comments, 400 for an empty or overlong one, 429 past the hourly limit.
 * @pathParams battleParams
 * @body BattleCommentBody
 * @response BattleCommentResponse
 * @tag Players
 * @openapi
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  // No moderation channel means nobody could ever publish one, so the comment
  // is refused rather than queued where no one reads.
  if (!reviewsEnabled()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  const wg = wgIdentityFromEmail(session?.user?.email);
  if (!session?.user || !wg) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (limiter.limited(session.user.id)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const parsed = BattleCommentBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await submitBattleComment({
    region,
    arenaUniqueId: normaliseBattleId(id),
    userId: session.user.id,
    authorRegion: wg.region,
    accountId: wg.accountId,
    nickname: session.user.name ?? String(wg.accountId),
    body: parsed.data.body,
  });
  if (result.outcome === SubmitBattleCommentOutcome.UnknownBattle) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (result.outcome === SubmitBattleCommentOutcome.Length) {
    return Response.json({ error: "comment_length" }, { status: 400 });
  }
  return jsonResponse(
    BattleCommentResponse,
    { id: result.id!, status: BattleCommentStatus.Pending },
    { headers: { "cache-control": "no-store" } },
  );
}
