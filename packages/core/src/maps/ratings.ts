import { and, eq } from "drizzle-orm";
import {
  isStarValue,
  MAP_DETAIL_AXES,
  MapRatingAxis,
  mapRatings,
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  normalizeReview,
  ReviewOutcome,
  TankReviewStatus,
  voterBracket,
  type NewMapRatingRow,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { reviewDigest } from "@unicum.gg/core/community/review-digest";
import { reviewsEnabled } from "@unicum.gg/core/community/reviews-open";
import { getMapRatingEligibility } from "@unicum.gg/core/maps/ratings-eligibility";
import { currentRegionGameVersion } from "@unicum.gg/core/wargaming/wot/game-version";
import { postMapRatingModerationCard } from "@unicum.gg/core/maps/rating-moderation-card";

/**
 * Recording an opinion about a map, and settling the written half of it.
 *
 * The same shape as the vehicle submission, down to the three-state contract on
 * the review text, because the two are the same transaction: one row per account
 * and per subject, upserted, with the prose trusted differently from the stars.
 * Everything subject-agnostic is imported rather than restated, including the
 * star guard, the review bounds, the normaliser, the digest, the review ladder
 * and whether the queue is open at all.
 *
 * What differs is only the evidence. A vehicle vote is signed with the voter's
 * record on that tank; a map vote has no such record to sign with (see
 * `ratings-eligibility`), so it carries the account's own, with the trailing
 * thirty days as the column that says whether the opinion is about the layout
 * as it stands.
 */

export type MapRatingSubmission = {
  /** The arena, not the slug: a renamed map keeps its id. */
  arenaId: string;
  /** For the moderation card and the link back to the page. */
  mapName: string;
  mapSlug: string;
  region: Region;
  accountId: number;
  /** Better Auth user id. Sign-in is required, so this is always set. */
  userId: string;
  nickname: string;
  overall: number;
  fun: number;
  /** The optional axes, any subset. Absent keys are left unanswered rather than
   * defaulted, so a radar never shows a three somebody did not give. */
  detail: Partial<Record<MapRatingAxis, number>>;
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

export enum SubmitMapRatingOutcome {
  Saved = "saved",
  /** Not enough battles on the account, or no record of it at all. */
  NotEligible = "not_eligible",
  /** A star outside 1 to 5. */
  Invalid = "invalid",
  /** The written opinion is too short or too long once normalised. Its own
   * outcome because the form can act on it, unlike a malformed body. */
  ReviewLength = "review_length",
}

export type SubmitMapRatingResult = {
  outcome: SubmitMapRatingOutcome;
  /** Why, when it was refused, so the form can say something useful. */
  eligibility?: Awaited<ReturnType<typeof getMapRatingEligibility>>;
  review?: ReviewOutcome;
};

/**
 * Save an opinion, replacing whatever this account said about the map before.
 *
 * A vote is edited rather than accumulated: the unique index is on (arena,
 * user), and the upsert below is what enforces "one opinion per player". The
 * evidence columns are rewritten on every edit, so a vote revised a year later
 * carries the record that revision was based on.
 *
 * The written part is treated separately from the stars, because they are
 * trusted differently. An edit that leaves the text untouched keeps its
 * existing verdict and the stamp of whoever gave it, so fixing a typo in the
 * stars neither sends an approved review back to the queue nor erases the
 * record of who published it.
 */
export async function submitMapRating(
  submission: MapRatingSubmission,
): Promise<SubmitMapRatingResult> {
  if (!isStarValue(submission.overall) || !isStarValue(submission.fun)) {
    return { outcome: SubmitMapRatingOutcome.Invalid };
  }
  for (const axis of MAP_DETAIL_AXES) {
    const value = submission.detail[axis];
    if (value !== undefined && !isStarValue(value)) {
      return { outcome: SubmitMapRatingOutcome.Invalid };
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
    return { outcome: SubmitMapRatingOutcome.ReviewLength };
  }

  const eligibility = await getMapRatingEligibility(
    submission.region,
    submission.accountId,
  );
  if (!eligibility.eligible || !eligibility.player) {
    return { outcome: SubmitMapRatingOutcome.NotEligible, eligibility };
  }

  const [existing] = await db
    .select({
      review: mapRatings.review,
      reviewStatus: mapRatings.reviewStatus,
    })
    .from(mapRatings)
    .where(
      and(
        eq(mapRatings.arenaId, submission.arenaId),
        eq(mapRatings.userId, submission.userId),
      ),
    )
    .limit(1);

  const previous = existing?.review ?? null;
  const previousStatus =
    (existing?.reviewStatus as TankReviewStatus | undefined) ??
    TankReviewStatus.None;
  const reviewsOpen = reviewsEnabled();

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

  const player = eligibility.player;
  const columns = {
    nickname: submission.nickname,
    region: submission.region,
    accountId: submission.accountId,
    overall: submission.overall,
    fun: submission.fun,
    balance: submission.detail[MapRatingAxis.Balance] ?? null,
    variety: submission.detail[MapRatingAxis.Variety] ?? null,
    flow: submission.detail[MapRatingAxis.Flow] ?? null,
    classFairness: submission.detail[MapRatingAxis.ClassFairness] ?? null,
    beginnerFriendliness:
      submission.detail[MapRatingAxis.BeginnerFriendliness] ?? null,
    playerWn8: player.wn8,
    playerBattles: player.battles,
    playerRecentBattles: player.recentBattles,
    playerWinrate: player.winrate,
    bracket: voterBracket(player.wn8),
    // Stamped rather than asked for: a map is reworked, and an opinion of it is
    // an opinion of the layout that was live. Read on the voter's own server,
    // since Wargaming rolls an update out region by region.
    gameVersion: await currentRegionGameVersion(submission.region),
    review: storedReview,
    reviewStatus,
    updatedAt: new Date(),
  };

  const values: NewMapRatingRow = {
    arenaId: submission.arenaId,
    userId: submission.userId,
    ...columns,
    // A fresh row has nothing published yet, whatever the update branch does.
    reviewedAt: null,
    reviewedBy: null,
  };

  const [row] = await db
    .insert(mapRatings)
    .values(values)
    .onConflictDoUpdate({
      target: [mapRatings.arenaId, mapRatings.userId],
      // Everything but `createdAt`: the row is the same opinion, revised. The
      // moderation columns are left out entirely when the stamp survives, since
      // a key that is present is a key that gets written.
      set: keepStamp
        ? columns
        : { ...columns, reviewedAt: null, reviewedBy: null },
    })
    .returning({ id: mapRatings.id });

  if (queueing && row && storedReview) {
    // Best-effort, like the vehicle card: the vote is saved either way, and
    // failing the submission because Discord hiccuped would ask someone to
    // retype an opinion the database already holds.
    await postMapRatingModerationCard({
      id: row.id,
      digest: reviewDigest(storedReview),
      mapName: submission.mapName,
      mapSlug: submission.mapSlug,
      region: submission.region,
      nickname: submission.nickname,
      overall: submission.overall,
      fun: submission.fun,
      battles: player.battles,
      recentBattles: player.recentBattles,
      winrate: player.winrate,
      playerWn8: player.wn8,
      body: storedReview,
    }).catch((err) =>
      console.error("[map-ratings] moderation card failed:", err),
    );
  }

  return {
    outcome: SubmitMapRatingOutcome.Saved,
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
export async function deleteMapRating(
  arenaId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(mapRatings)
    .where(and(eq(mapRatings.arenaId, arenaId), eq(mapRatings.userId, userId)))
    .returning({ id: mapRatings.id });
  return rows.length > 0;
}
