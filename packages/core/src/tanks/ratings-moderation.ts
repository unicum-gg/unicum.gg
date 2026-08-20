import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { TankReviewStatus, tankRatings } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * Settling the written half of a rating.
 *
 * Its own module because it answers to a different actor than the rest: a vote
 * is written by its author, a review is published by a moderator, and the two
 * paths meet only through the row they share.
 */

/**
 * A short fingerprint of the text a moderation card was posted about.
 *
 * The card carries it and the approval checks it against what the row holds
 * now. Without it a card is just a row id, and a row's text can change after
 * the card was posted: an author could submit something reasonable, wait for
 * the card, replace it with abuse, and have a moderator working the backlog
 * publish the abuse by pressing Approve on the reasonable prose they were
 * reading. Eight hex characters is not a boundary against a preimage attack,
 * it is a guard against the row having moved, which is all this needs to be.
 */
export function reviewDigest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 8);
}

/** How a press on a moderation card was resolved. */
export enum ReviewDecision {
  Settled = "settled",
  /** Unknown id, or somebody already pressed a button on it. */
  AlreadyReviewed = "already_reviewed",
  /** The row's text has changed since this card was posted, so the card is
   * about prose that no longer exists. A newer card carries the new text. */
  Stale = "stale",
}

export type ReviewedRating = {
  decision: ReviewDecision;
  tankId?: number;
  nickname?: string;
  status?: TankReviewStatus;
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
export async function reviewTankRating(
  id: number,
  approved: boolean,
  moderatorId: string,
  digest: string,
): Promise<ReviewedRating> {
  const status = approved
    ? TankReviewStatus.Approved
    : TankReviewStatus.Rejected;

  const [row] = await db
    .update(tankRatings)
    .set({
      reviewStatus: status,
      reviewedAt: new Date(),
      reviewedBy: moderatorId,
    })
    .where(
      and(
        eq(tankRatings.id, id),
        eq(tankRatings.reviewStatus, TankReviewStatus.Pending),
        // Computed in the database so the check and the write are one
        // statement: reading the text, hashing it here and updating afterwards
        // would leave a window for the author to edit in between.
        sql`LEFT(ENCODE(SHA256(CONVERT_TO(${tankRatings.review}, 'UTF8')), 'hex'), 8) = ${digest}`,
      ),
    )
    .returning({
      tankId: tankRatings.tankId,
      nickname: tankRatings.nickname,
    });

  if (row) return { decision: ReviewDecision.Settled, ...row, status };

  // Nothing was written, so say which of the two reasons it was: the bot puts
  // very different words on the card for each.
  const [current] = await db
    .select({ reviewStatus: tankRatings.reviewStatus })
    .from(tankRatings)
    .where(eq(tankRatings.id, id))
    .limit(1);
  return {
    decision:
      current?.reviewStatus === TankReviewStatus.Pending
        ? ReviewDecision.Stale
        : ReviewDecision.AlreadyReviewed,
  };
}
