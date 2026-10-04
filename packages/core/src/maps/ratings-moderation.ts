import { and, eq } from "drizzle-orm";
import { mapRatings, TankReviewStatus } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { reviewDigestMatches } from "@unicum.gg/core/community/review-digest";
import { ReviewDecision } from "@unicum.gg/core/community/review-decision";

/**
 * Settling the written half of a map rating.
 *
 * Its own module because it answers to a different actor than the rest: a vote
 * is written by its author, a review is published by a moderator, and the two
 * paths meet only through the row they share.
 *
 * `ReviewDecision` is shared with the vehicle queue rather than redeclared: the
 * three outcomes of a press are a property of the mechanism, not of what was
 * reviewed.
 */

export type ReviewedMapRating = {
  decision: ReviewDecision;
  arenaId?: string;
  nickname?: string;
  status?: TankReviewStatus;
  /** The author, so they can be told what became of their text. Read back from
   * the same statement that settled it rather than queried after: the row is
   * deleted with the account, so a second read can come back empty for an
   * author who was there a moment ago. */
  userId?: string;
  /** What they wrote, quoted back to them in that notice. Unchanged by the
   * update, which only touches the review's status. */
  review?: string | null;
};

/**
 * Settle a queued written opinion.
 *
 * Guarded on three things at once, and the third is the one that matters: the
 * row is still pending, and its text still hashes to what the card was posted
 * about. A card is a durable button on Discord's side, so it outlives the text
 * it was created for, and approving on identity alone would publish whatever
 * the row happens to hold at the moment of the press rather than what the
 * moderator read.
 *
 * A rejection keeps the row: the stars were never in question, and only the
 * prose is withdrawn.
 */
export async function reviewMapRating(
  id: number,
  approved: boolean,
  moderatorId: string,
  digest: string,
): Promise<ReviewedMapRating> {
  const status = approved
    ? TankReviewStatus.Approved
    : TankReviewStatus.Rejected;

  const [row] = await db
    .update(mapRatings)
    .set({
      reviewStatus: status,
      reviewedAt: new Date(),
      reviewedBy: moderatorId,
    })
    .where(
      and(
        eq(mapRatings.id, id),
        eq(mapRatings.reviewStatus, TankReviewStatus.Pending),
        // Computed in the database so the check and the write are one
        // statement: reading the text, hashing it here and updating afterwards
        // would leave a window for the author to edit in between.
        reviewDigestMatches(mapRatings.review, digest),
      ),
    )
    .returning({
      arenaId: mapRatings.arenaId,
      nickname: mapRatings.nickname,
      userId: mapRatings.userId,
      review: mapRatings.review,
    });

  if (row) return { decision: ReviewDecision.Settled, ...row, status };

  // Nothing was written, so say which of the two reasons it was: the bot puts
  // very different words on the card for each.
  const [current] = await db
    .select({ reviewStatus: mapRatings.reviewStatus })
    .from(mapRatings)
    .where(eq(mapRatings.id, id))
    .limit(1);
  return {
    decision:
      current?.reviewStatus === TankReviewStatus.Pending
        ? ReviewDecision.Stale
        : ReviewDecision.AlreadyReviewed,
  };
}
