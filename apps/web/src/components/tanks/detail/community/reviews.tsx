import {
  RATING_COLOR_HEX,
  VOTER_BRACKET_LABEL,
  VoterBracket,
  wn8Color,
  type TankReview,
} from "@unicum.gg/shared";
import { REGION_LABEL } from "@unicum.gg/wargaming";
import { RelativeTime } from "@/components/relative-time";
import { PlayerName } from "@/components/entity/player-name";
import { Stars } from "./stars";

const intFmt = new Intl.NumberFormat("en-US");

/**
 * What players wrote about the tank.
 *
 * Every review is signed with the author's record on this exact vehicle rather
 * than with a name and a join date. That is the whole difference between this
 * and a comment section: "he says it has no armour" means one thing from
 * somebody with nine hundred battles in it and another thing entirely from
 * somebody with twenty-six, and the reader is given both halves at once instead
 * of being asked to take the sentence on trust.
 *
 * The client version it was written under is shown for the same reason. A
 * verdict formed two rebalances ago is not wrong, it is dated, and only the
 * stamp can say which.
 */
export function TankReviews({ reviews }: { reviews: TankReview[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        No written opinions yet. If you have the battles, yours would be the
        first.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-fd-border">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: TankReview }) {
  const bracketColor =
    review.playerWn8 == null
      ? undefined
      : RATING_COLOR_HEX[wn8Color(review.playerWn8)];

  return (
    <article className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PlayerName
          region={review.region}
          player={{ nickname: review.nickname }}
          className="text-sm"
        />
        {review.bracket === VoterBracket.Unknown ? null : (
          <span
            className="text-xs font-medium"
            style={bracketColor ? { color: bracketColor } : undefined}
          >
            {VOTER_BRACKET_LABEL[review.bracket]}
          </span>
        )}
        <span className="text-xs text-fd-muted-foreground">
          {REGION_LABEL[review.region]}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <Stars value={review.overall} size={13} />
          <RelativeTime
            date={review.createdAt}
            className="text-xs text-fd-muted-foreground"
          />
        </span>
      </header>

      {/* The receipt. Stated before the opinion rather than after it, because it
        is what tells a reader how much of the opinion to take. */}
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fd-muted-foreground tabular-nums">
        <span>
          <span className="font-medium text-fd-foreground">
            {intFmt.format(review.battles)}
          </span>{" "}
          battles in it
        </span>
        {review.winrate != null ? (
          <span>{(review.winrate * 100).toFixed(1)}% win rate</span>
        ) : null}
        {review.avgDamage != null ? (
          <span>{intFmt.format(Math.round(review.avgDamage))} damage</span>
        ) : null}
        {review.marksOnGun ? (
          <span>
            {review.marksOnGun} {review.marksOnGun === 1 ? "mark" : "marks"}
          </span>
        ) : null}
        {review.gameVersion ? <span>written on {review.gameVersion}</span> : null}
      </p>

      {/* Plain text, rendered as text: a review is prose, and the one place a
        community feature must not accept markup is the one where strangers
        write it. Line breaks are kept, because a list of pros and cons is how
        people write these. */}
      <p className="whitespace-pre-line text-sm leading-relaxed">
        {review.body}
      </p>
    </article>
  );
}
