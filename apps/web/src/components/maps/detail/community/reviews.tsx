import { numberFormat } from "@/lib/format";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import {
  RATING_COLOR_HEX,
  VoterBracket,
  wn8Color,
  type MapReview,
} from "@unicum.gg/shared";
import { REGION_LABEL } from "@unicum.gg/wargaming";
import { RelativeTime } from "@/components/relative-time";
import { PlayerName } from "@/components/entity/player-name";
import { Stars } from "@/components/tanks/detail/community/stars";

const INT_FORMAT = {} as const;

/**
 * What players wrote about the map.
 *
 * Every review is signed with the author's record, and the receipt is the whole
 * difference from a comment section. On a vehicle that receipt is a claim about
 * the subject, battles on this exact tank, and it is what makes "he says it has
 * no armour" weigh differently from nine hundred battles than from twenty-six.
 *
 * Nothing can make that claim about an arena: Wargaming publishes no per-map
 * record, for us or for anybody, so what is printed here is deliberately a
 * claim about the AUTHOR instead. The trailing thirty days lead it, because a
 * map is reworked between updates and that is the column separating a verdict
 * on the ground as it stands from one formed before the last rework. The client
 * version is shown for the same reason, and only the stamp can say which.
 */
export async function MapReviews({
  reviews,
  locale,
}: {
  reviews: MapReview[];
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/detail/community/reviews",
    locale,
  );
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        {t("no-written-opinions-yet")}
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-fd-border">
      {reviews.map((review) => (
        <ReviewCard locale={locale} key={review.id} review={review} />
      ))}
    </div>
  );
}

async function ReviewCard({
  review,
  locale,
}: {
  review: MapReview;
  locale: string;
}) {
  const { t: tLabel } = await getTranslation("components/labels", locale);
  const { t } = await getTranslation(
    "components/maps/detail/community/reviews",
    locale,
  );
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
            {tLabel(`voter-brackets.${review.bracket}`)}
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
        {review.recentBattles != null ? (
          <span>
            <Interpolate
              template={t("battles-recently")}
              values={{
                battles: (
                  <span className="font-medium text-fd-foreground">
                    {numberFormat(locale, INT_FORMAT).format(
                      review.recentBattles,
                    )}
                  </span>
                ),
              }}
            />
          </span>
        ) : null}
        {review.battles != null ? (
          <span>
            {t("battles-overall", {
              battles: numberFormat(locale, INT_FORMAT).format(review.battles),
            })}
          </span>
        ) : null}
        {review.winrate != null ? (
          <span>
            {t("win-rate", { winrate: (review.winrate * 100).toFixed(1) })}
          </span>
        ) : null}
        {review.gameVersion ? (
          <span>{t("written-on", { gameVersion: review.gameVersion })}</span>
        ) : null}
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
