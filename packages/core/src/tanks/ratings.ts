import { and, eq } from "drizzle-orm";
import {
  DETAIL_AXES,
  env,
  isStarValue,
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  normalizeReview,
  ReviewOutcome,
  TankRatingAxis,
  TankReviewStatus,
  tankRatings,
  voterBracket,
  type NewTankRatingRow,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { discordBotEnabled } from "@unicum.gg/core/discord";
import { getRatingEligibility } from "@unicum.gg/core/tanks/ratings-eligibility";
import { wg } from "@unicum.gg/core/wargaming/client";
import { reviewDigest } from "@unicum.gg/core/tanks/ratings-moderation";
import { postRatingModerationCard } from "@unicum.gg/core/tanks/rating-moderation-card";

/**
 * Recording an opinion, and settling the written half of it.
 *
 * The check that decides whether an account may vote at all lives next door in
 * `ratings-eligibility`; this file assumes it has passed and deals with what is
 * written down, which is trusted differently: the stars are counted the instant
 * they are cast, the sentence beside them only once someone has read it.
 */

/** Written opinions only open when a moderator could actually read them: a
 * queue nobody looks at is worse than no queue. The stars are unaffected, they
 * need no review. */
export function tankReviewsEnabled(): boolean {
  return discordBotEnabled() && Boolean(env.DISCORD_REVIEW_CHANNEL_ID);
}

export type RatingSubmission = {
  tankId: number;
  /** For the moderation card and the link back to the page. */
  tankName: string;
  tankSlug: string;
  region: Region;
  accountId: number;
  /** Better Auth user id. Sign-in is required, so this is always set. */
  userId: string;
  nickname: string;
  overall: number;
  fun: number;
  /** The optional axes, any subset. Absent keys are left unanswered rather than
   * defaulted, so a radar never shows a three somebody did not give. */
  detail: Partial<Record<TankRatingAxis, number>>;
  /**
   * The written opinion. Three states, and they are three different
   * instructions: a string replaces it, `null` withdraws it, and `undefined`
   * leaves whatever is already there alone.
   *
   * The distinction is the whole contract of an edit. Collapsing absent into
   * null, which is what an `?? null` at the boundary does, means a caller who
   * sends only new stars silently destroys a published review.
   */
  review: string | null | undefined;
};

export enum SubmitRatingOutcome {
  Saved = "saved",
  /** Not enough battles on the tank, or no record of them. */
  NotEligible = "not_eligible",
  /** A star outside 1 to 5. */
  Invalid = "invalid",
  /** The written opinion is too short or too long once normalised. Its own
   * outcome because the form can act on it, unlike a malformed body. */
  ReviewLength = "review_length",
}

export type SubmitRatingResult = {
  outcome: SubmitRatingOutcome;
  /** Why, when it was refused, so the form can say something useful. */
  eligibility?: Awaited<ReturnType<typeof getRatingEligibility>>;
  review?: ReviewOutcome;
};

/**
 * The client version the vote is cast under, stamped rather than asked for.
 *
 * A tank is buffed and nerfed, and an opinion of it is an opinion of the
 * version it was played in: this is what lets the page draw the community's
 * verdict against the changes it already tracks. Null when WG does not answer,
 * which is better than a wrong version.
 */
async function currentGameVersion(region: Region): Promise<string | null> {
  return wg
    .region(region)
    .api.wot.encyclopedia.info({ fields: ["game_version"] })
    .then((info) => info.game_version ?? null)
    .catch(() => null);
}

/**
 * Save an opinion, replacing whatever this account said about the tank before.
 *
 * A vote is edited rather than accumulated: the unique index is on (tank,
 * user), and the upsert below is what enforces "one opinion per player". The
 * evidence columns are rewritten on every edit, so a vote revised after another
 * thousand battles carries the record that revision was based on.
 *
 * The written part is treated separately from the stars, because they are
 * trusted differently. An edit that leaves the text untouched keeps its
 * existing verdict and the stamp of whoever gave it, so fixing a typo in the
 * stars neither sends an approved review back to the queue nor erases the
 * record of who published it.
 */
export async function submitTankRating(
  submission: RatingSubmission,
): Promise<SubmitRatingResult> {
  if (!isStarValue(submission.overall) || !isStarValue(submission.fun)) {
    return { outcome: SubmitRatingOutcome.Invalid };
  }
  for (const axis of DETAIL_AXES) {
    const value = submission.detail[axis];
    if (value !== undefined && !isStarValue(value)) {
      return { outcome: SubmitRatingOutcome.Invalid };
    }
  }

  // Normalised before it is measured, and the form normalises with the same
  // function before it counts: measuring the raw string here would reject prose
  // the button said was long enough.
  const leaveTextAlone = submission.review === undefined;
  const review = submission.review ? normalizeReview(submission.review) : null;
  if (
    review &&
    (review.length < MIN_REVIEW_LENGTH || review.length > MAX_REVIEW_LENGTH)
  ) {
    return { outcome: SubmitRatingOutcome.ReviewLength };
  }

  const eligibility = await getRatingEligibility(
    submission.region,
    submission.accountId,
    submission.tankId,
  );
  if (!eligibility.eligible || !eligibility.record) {
    return { outcome: SubmitRatingOutcome.NotEligible, eligibility };
  }

  const [existing] = await db
    .select({
      review: tankRatings.review,
      reviewStatus: tankRatings.reviewStatus,
    })
    .from(tankRatings)
    .where(
      and(
        eq(tankRatings.tankId, submission.tankId),
        eq(tankRatings.userId, submission.userId),
      ),
    )
    .limit(1);

  const previous = existing?.review ?? null;
  const previousStatus =
    (existing?.reviewStatus as TankReviewStatus | undefined) ??
    TankReviewStatus.None;
  const reviewsOpen = tankReviewsEnabled();

  // What the row should end up holding, and why. `undefined` from the caller
  // means they said nothing about the text, so nothing about it changes.
  const nextText = leaveTextAlone ? previous : review;
  const textChanged = !leaveTextAlone && review !== previous;
  const queueing = Boolean(nextText) && textChanged && reviewsOpen;

  const reviewStatus = !nextText
    ? TankReviewStatus.None
    : queueing
      ? TankReviewStatus.Pending
      : textChanged
        ? // Reviews are closed, so the stars are kept and the text is not
          // stored at all: holding prose nobody will ever read is worse than
          // telling the author it did not go through.
          TankReviewStatus.None
        : previousStatus;
  const storedReview =
    reviewStatus === TankReviewStatus.None && textChanged ? null : nextText;

  // The moderation stamp survives exactly when the verdict does. Rewriting it
  // on an unrelated edit would erase the record of who published the text.
  const keepStamp =
    !textChanged &&
    previousStatus === reviewStatus &&
    previousStatus !== TankReviewStatus.None;

  const record = eligibility.record;
  const player = eligibility.player;
  const now = new Date();
  const columns = {
    nickname: submission.nickname,
    region: submission.region,
    accountId: submission.accountId,
    overall: submission.overall,
    fun: submission.fun,
    firepower: submission.detail[TankRatingAxis.Firepower] ?? null,
    armour: submission.detail[TankRatingAxis.Armour] ?? null,
    mobility: submission.detail[TankRatingAxis.Mobility] ?? null,
    gunHandling: submission.detail[TankRatingAxis.GunHandling] ?? null,
    concealment: submission.detail[TankRatingAxis.Concealment] ?? null,
    beginnerFriendliness:
      submission.detail[TankRatingAxis.BeginnerFriendliness] ?? null,
    versatility: submission.detail[TankRatingAxis.Versatility] ?? null,
    battles: record.battles,
    winrate: record.winrate,
    avgDamage: record.avgDamage,
    tankWn8: record.tankWn8,
    marksOnGun: record.marksOnGun,
    markOfMastery: record.markOfMastery,
    playerWn8: player?.wn8 ?? null,
    playerBattles: player?.battles ?? null,
    bracket: voterBracket(player?.wn8 ?? null),
    gameVersion: await currentGameVersion(submission.region),
    review: storedReview,
    reviewStatus,
    updatedAt: now,
  };

  const values: NewTankRatingRow = {
    tankId: submission.tankId,
    userId: submission.userId,
    ...columns,
    // A fresh row has nothing published yet, whatever the update branch does.
    reviewedAt: null,
    reviewedBy: null,
  };

  const [row] = await db
    .insert(tankRatings)
    .values(values)
    .onConflictDoUpdate({
      target: [tankRatings.tankId, tankRatings.userId],
      // Everything but `createdAt`: the row is the same opinion, revised. The
      // moderation columns are left out entirely when the stamp survives, since
      // a key that is present is a key that gets written.
      set: keepStamp
        ? columns
        : { ...columns, reviewedAt: null, reviewedBy: null },
    })
    .returning({ id: tankRatings.id });

  if (queueing && row && storedReview) {
    // Best-effort, like the video card: the vote is saved either way, and
    // failing the submission because Discord hiccuped would ask someone to
    // retype an opinion the database already holds.
    await postRatingModerationCard({
      id: row.id,
      digest: reviewDigest(storedReview),
      tankName: submission.tankName,
      tankSlug: submission.tankSlug,
      region: submission.region,
      nickname: submission.nickname,
      overall: submission.overall,
      fun: submission.fun,
      battles: record.battles,
      winrate: record.winrate,
      avgDamage: record.avgDamage,
      playerWn8: player?.wn8 ?? null,
      body: storedReview,
    }).catch((err) =>
      console.error("[tank-ratings] moderation card failed:", err),
    );
  }

  return {
    outcome: SubmitRatingOutcome.Saved,
    review: reviewOutcomeOf({
      storedReview,
      queueing,
      textChanged,
      reviewsOpen,
      status: reviewStatus,
    }),
  };
}

/**
 * What actually became of the text, stated rather than inferred.
 *
 * The form tells the author what happened to their review, so this has to be
 * true and not merely "there was text in the request". Saying "with a
 * moderator" about prose that was rejected weeks ago, or about prose that is
 * already live, is a small lie the author has no way to check.
 */
function reviewOutcomeOf(s: {
  storedReview: string | null;
  queueing: boolean;
  textChanged: boolean;
  reviewsOpen: boolean;
  status: TankReviewStatus;
}): ReviewOutcome {
  if (s.queueing) return ReviewOutcome.Queued;
  if (!s.storedReview) {
    return s.textChanged && !s.reviewsOpen
      ? ReviewOutcome.Closed
      : ReviewOutcome.None;
  }
  switch (s.status) {
    case TankReviewStatus.Approved:
      return ReviewOutcome.Published;
    case TankReviewStatus.Pending:
      return ReviewOutcome.Pending;
    case TankReviewStatus.Rejected:
      return ReviewOutcome.Rejected;
    default:
      return ReviewOutcome.None;
  }
}

/** Take an opinion back. The stars go with the text: what is being withdrawn is
 * the whole verdict, not the sentence explaining it. */
export async function deleteTankRating(
  tankId: number,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(tankRatings)
    .where(and(eq(tankRatings.tankId, tankId), eq(tankRatings.userId, userId)))
    .returning({ id: tankRatings.id });
  return rows.length > 0;
}
