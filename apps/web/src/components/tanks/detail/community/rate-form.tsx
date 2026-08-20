"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  DETAIL_AXES,
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  normalizeReview,
  QUICK_AXES,
  ReviewOutcome,
  TANK_RATING_AXIS_HINT,
  TANK_RATING_AXIS_LABEL,
  TankRatingAxis,
  TankReviewStatus,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { UnicumError } from "@unicum.gg/sdk";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { unicum } from "@/services/sdk";
import { StarInput } from "./star-input";
import type { OwnRatingState } from "./rate-panel";

const intFmt = new Intl.NumberFormat("en-US");

type Answers = Partial<Record<TankRatingAxis, number>>;

/**
 * What actually became of the written opinion, in the author's words.
 *
 * The endpoint distinguishes six outcomes and this says six things, because the
 * cheap version ("your review is with a moderator" whenever text was sent) is a
 * claim the author cannot check and that is false in four of them.
 */
const REVIEW_MESSAGE: Record<ReviewOutcome, string> = {
  [ReviewOutcome.None]: "Rating saved.",
  [ReviewOutcome.Queued]: "Rating saved. Your review is with a moderator.",
  [ReviewOutcome.Published]: "Rating saved. Your review is already live.",
  [ReviewOutcome.Pending]: "Rating saved. Your review is still waiting on a moderator.",
  [ReviewOutcome.Rejected]:
    "Rating saved. Your earlier review was not published, so only your stars count.",
  [ReviewOutcome.Closed]:
    "Rating saved. Written opinions are closed right now, so the text was not kept.",
};

export function RateForm({
  region,
  slug,
  me,
  onSaved,
}: {
  region: Region;
  slug: string;
  me: OwnRatingState;
  onSaved: () => void;
}) {
  const existing = me.rating;
  const [overall, setOverall] = useState<number | null>(
    existing?.overall ?? null,
  );
  const [fun, setFun] = useState<number | null>(existing?.fun ?? null);
  const [axes, setAxes] = useState<Answers>(() =>
    Object.fromEntries(
      (existing?.axes ?? []).map((a: { axis: string; value: number }) => [
        a.axis,
        a.value,
      ]),
    ) as Answers,
  );
  // Opened by default when the reader has already filled some in: hiding what
  // they wrote behind a closed disclosure reads as having lost it.
  const [detailOpen, setDetailOpen] = useState(
    (existing?.axes.length ?? 0) > 0,
  );
  const [review, setReview] = useState(existing?.review ?? "");
  const [saving, setSaving] = useState(false);

  // Measured on the normalised string, the same one the server will store and
  // then measure. Counting raw characters here let somebody write eighty-two
  // characters of double-spaced prose, enabled the button, and earned a 400.
  const reviewLength = normalizeReview(review).length;
  const reviewTooShort = reviewLength > 0 && reviewLength < MIN_REVIEW_LENGTH;
  const canSave =
    overall != null && fun != null && !reviewTooShort && !saving;

  async function save() {
    if (overall == null || fun == null) return;
    setSaving(true);
    try {
      const result = await unicum
        .region(region)
        .tanks(slug)
        .rate({
          overall,
          fun,
          firepower: axes[TankRatingAxis.Firepower] ?? null,
          armour: axes[TankRatingAxis.Armour] ?? null,
          mobility: axes[TankRatingAxis.Mobility] ?? null,
          gunHandling: axes[TankRatingAxis.GunHandling] ?? null,
          concealment: axes[TankRatingAxis.Concealment] ?? null,
          beginnerFriendliness: axes[TankRatingAxis.BeginnerFriendliness] ?? null,
          versatility: axes[TankRatingAxis.Versatility] ?? null,
          // Null, not undefined: an empty box on a form the author is looking
          // at is an instruction to withdraw the text. Absent would mean "leave
          // it alone", which is not what an emptied field says.
          review: reviewLength > 0 ? review : null,
        });
      toast.success(REVIEW_MESSAGE[result.review as ReviewOutcome] ?? "Rating saved.");
      onSaved();
    } catch (err) {
      // 403 is the eligibility gate closing between the check and the press,
      // which happens when someone signs in on a second tab. Worth its own
      // wording: "something went wrong" would send them looking for a bug.
      const status = err instanceof UnicumError ? err.status : 0;
      toast.error(
        status === 403
          ? "You have not played this tank enough for a vote to count."
          : status === 429
            ? "That is a lot of edits at once. Give it a minute."
            : status === 400
              ? `Your review needs to be between ${MIN_REVIEW_LENGTH} and ${MAX_REVIEW_LENGTH} characters.`
              : "Could not save that. Try again in a moment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    setSaving(true);
    try {
      await unicum.region(region).tanks(slug).rateWithdraw();
      toast.success("Your rating has been withdrawn.");
      onSaved();
    } catch {
      toast.error("Could not withdraw that. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
        {QUICK_AXES.map((axis) => (
          <div key={axis} className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {TANK_RATING_AXIS_LABEL[axis]}
            </span>
            <StarInput
              name={TANK_RATING_AXIS_LABEL[axis]}
              value={axis === TankRatingAxis.Overall ? overall : fun}
              onChange={axis === TankRatingAxis.Overall ? setOverall : setFun}
              disabled={saving}
            />
            <span className="text-xs text-fd-muted-foreground">
              {TANK_RATING_AXIS_HINT[axis]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setDetailOpen((open) => !open)}
          className="w-fit cursor-pointer text-sm text-fd-muted-foreground underline-offset-4 hover:underline"
        >
          {detailOpen ? "Hide the detailed axes" : "Rate it in detail (optional)"}
        </button>

        {detailOpen ? (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {DETAIL_AXES.map((axis) => (
              <div
                key={axis}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
              >
                <div className="flex flex-col">
                  <span className="text-sm">
                    {TANK_RATING_AXIS_LABEL[axis]}
                  </span>
                  <span className="text-xs text-fd-muted-foreground">
                    {TANK_RATING_AXIS_HINT[axis]}
                  </span>
                </div>
                <StarInput
                  name={TANK_RATING_AXIS_LABEL[axis]}
                  value={axes[axis] ?? null}
                  onChange={(value) =>
                    setAxes((prev) => ({ ...prev, [axis]: value }))
                  }
                  size={17}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {me.reviewsOpen ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tank-review" className="text-sm font-medium">
            Say why (optional)
          </label>
          <Textarea
            id="tank-review"
            value={review}
            maxLength={MAX_REVIEW_LENGTH}
            disabled={saving}
            onChange={(e) => setReview(e.target.value)}
            placeholder="What it is good at, what it is not, and who should play it."
            className="min-h-24"
          />
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-fd-muted-foreground">
            <span>
              {reviewTooShort
                ? `A few more words: ${MIN_REVIEW_LENGTH - reviewLength} to go.`
                : "Published once a moderator has read it. Your stars count straight away."}
            </span>
            <span className="tabular-nums">
              {reviewLength}/{MAX_REVIEW_LENGTH}
            </span>
          </p>
          {existing?.reviewStatus === TankReviewStatus.Pending ? (
            <p className="text-xs text-amber-500">
              Your review is waiting on a moderator. Only you can see it here.
            </p>
          ) : null}
          {existing?.reviewStatus === TankReviewStatus.Rejected ? (
            <p className="text-xs text-fd-muted-foreground">
              Your review was not published. Your stars still count towards the
              average.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={save} disabled={!canSave}>
          {existing ? "Update my rating" : "Submit my rating"}
        </Button>
        {existing ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={withdraw}
            disabled={saving}
          >
            Withdraw
          </Button>
        ) : null}
        {me.record ? (
          <span className="text-xs text-fd-muted-foreground tabular-nums">
            Signed with your {intFmt.format(me.record.battles)} battles in it
            {me.record.winrate != null ? (
              <> at {(me.record.winrate * 100).toFixed(1)}%</>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Prompt({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-2xl text-sm text-fd-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
