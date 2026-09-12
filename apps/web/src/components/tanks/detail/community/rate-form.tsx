"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { useState } from "react";
import { toast } from "sonner";
import {
  DETAIL_AXES,
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  normalizeReview,
  QUICK_AXES,
  ReviewOutcome,
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

const INT_FORMAT = {} as const;

type Answers = Partial<Record<TankRatingAxis, number>>;

/**
 * What actually became of the written opinion, in the author's words.
 *
 * The endpoint distinguishes six outcomes and this says six things, because the
 * cheap version ("your review is with a moderator" whenever text was sent) is a
 * claim the author cannot check and that is false in four of them.
 */
/**
 * What the toast says, by what became of the written half of a rating.
 *
 * The outcome is the key rather than the sentence, so the six readings live in
 * the locale files like every other string and a new outcome is a key that does
 * not resolve rather than a sentence in English.
 */
const REVIEW_KEY: Record<ReviewOutcome, string> = {
  [ReviewOutcome.None]: "review.none",
  [ReviewOutcome.Queued]: "review.queued",
  [ReviewOutcome.Published]: "review.published",
  [ReviewOutcome.Pending]: "review.pending",
  [ReviewOutcome.Rejected]: "review.rejected",
  [ReviewOutcome.Closed]: "review.closed",
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
  const { num } = useFormat();
  const { t: tLabel } = useTranslation("components/labels");
  const { t } = useTranslation("components/tanks/detail/community/rate-form");
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
      toast.success(
        t(REVIEW_KEY[result.review as ReviewOutcome] ?? "review.none"),
      );
      onSaved();
    } catch (err) {
      // 403 is the eligibility gate closing between the check and the press,
      // which happens when someone signs in on a second tab. Worth its own
      // wording: "something went wrong" would send them looking for a bug.
      const status = err instanceof UnicumError ? err.status : 0;
      toast.error(
        status === 403
          ? t("not-enough-battles")
          : status === 429
            ? t("too-many-edits")
            : status === 400
              ? `Your review needs to be between ${MIN_REVIEW_LENGTH} and ${MAX_REVIEW_LENGTH} characters.`
              : t("save-failed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    setSaving(true);
    try {
      await unicum.region(region).tanks(slug).rateWithdraw();
      toast.success(t("your-rating-has-been-withdrawn"));
      onSaved();
    } catch {
      toast.error(t("could-not-withdraw-that-try-again-in-a-momen"));
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
              {tLabel(`rating-axes.${axis}`)}
            </span>
            <StarInput
              name={tLabel(`rating-axes.${axis}`)}
              value={axis === TankRatingAxis.Overall ? overall : fun}
              onChange={axis === TankRatingAxis.Overall ? setOverall : setFun}
              disabled={saving}
            />
            <span className="text-xs text-fd-muted-foreground">
              {tLabel(`rating-axis-hints.${axis}`)}
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
          {detailOpen ? t("hide-the-detailed-axes") : t("rate-it-in-detail")}
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
                    {tLabel(`rating-axes.${axis}`)}
                  </span>
                  <span className="text-xs text-fd-muted-foreground">
                    {tLabel(`rating-axis-hints.${axis}`)}
                  </span>
                </div>
                <StarInput
                  name={tLabel(`rating-axes.${axis}`)}
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
            {t("say-why-optional")}</label>
          <Textarea
            id="tank-review"
            value={review}
            maxLength={MAX_REVIEW_LENGTH}
            disabled={saving}
            onChange={(e) => setReview(e.target.value)}
            placeholder={t("what-it-is-good-at")}
            className="min-h-24"
          />
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-fd-muted-foreground">
            <span>
              {reviewTooShort
                ? t("a-few-more-words", {
                    count: MIN_REVIEW_LENGTH - reviewLength,
                  })
                : t("published-once-read")}
            </span>
            <span className="tabular-nums">
              {reviewLength}/{MAX_REVIEW_LENGTH}
            </span>
          </p>
          {existing?.reviewStatus === TankReviewStatus.Pending ? (
            <p className="text-xs text-amber-500">
              {t("your-review-is-waiting-on")}</p>
          ) : null}
          {existing?.reviewStatus === TankReviewStatus.Rejected ? (
            <p className="text-xs text-fd-muted-foreground">
              {t("your-review-was-not-published")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={save} disabled={!canSave}>
          {existing ? t("update-my-rating") : t("submit-my-rating")}
        </Button>
        {existing ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={withdraw}
            disabled={saving}
          >
            {t("withdraw")}</Button>
        ) : null}
        {me.record ? (
          <span className="text-xs text-fd-muted-foreground tabular-nums">
            {t("signed-with", {
              battles: num(INT_FORMAT).format(me.record.battles),
            })}
            {me.record.winrate != null
              ? ` ${t("at-winrate", {
                  winrate: (me.record.winrate * 100).toFixed(1),
                })}`
              : null}
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
