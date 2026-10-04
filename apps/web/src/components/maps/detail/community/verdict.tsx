import { numberFormat } from "@/lib/format";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import type { MapRatingSummary, RatingConsensus } from "@unicum.gg/shared";
import { Stars, StarValue } from "@/components/tanks/detail/community/stars";
import { StarHistogram } from "@/components/tanks/detail/community/histogram";

const INT_FORMAT = {} as const;

/**
 * The headline: what the community makes of this map, and how much weight that
 * carries.
 *
 * The two figures sit side by side because they answer different questions and
 * regularly disagree, more often here than on a vehicle: a map can be the
 * fairest ground in the game and a slog to be sent to, or wildly unbalanced and
 * the one everybody hopes for. A single score would average those into a number
 * that describes neither.
 *
 * The line under them is the part that has to be read carefully, and it is
 * worded to be. On a vehicle the equivalent says how many battles the voters
 * have on the tank, which is a claim about the subject. Nothing can say that
 * about an arena, because Wargaming publishes no per-map record for anyone, so
 * what is printed instead is how much the voters have been playing at all,
 * which is what separates a verdict on the layout as it stands from one formed
 * before the last rework.
 */
export async function MapCommunityVerdict({
  summary,
  locale,
}: {
  summary: MapRatingSummary;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/detail/community/verdict",
    locale,
  );
  if (summary.votes === 0) return <NoVotesYet locale={locale} />;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <ScoreBlock
        locale={locale}
        label={t("overall")}
        hint={t("how-good-the-map-is")}
        value={summary.overall}
        votes={summary.votes}
        distribution={summary.overallDistribution}
        consensus={summary.consensus}
      />
      <ScoreBlock
        locale={locale}
        label={t("fun")}
        hint={t("how-much-people-enjoy-it")}
        value={summary.fun}
        votes={summary.votes}
        distribution={summary.funDistribution}
      />
      <p className="text-xs text-fd-muted-foreground sm:col-span-2">
        {summary.avgVoterRecentBattles == null ? (
          t("every-vote-signed")
        ) : (
          <Interpolate
            template={t("every-vote-signed-average")}
            values={{
              battles: (
                <span className="font-medium text-fd-foreground tabular-nums">
                  {numberFormat(locale, INT_FORMAT).format(
                    Math.round(summary.avgVoterRecentBattles),
                  )}
                </span>
              ),
            }}
          />
        )}
      </p>
    </div>
  );
}

async function ScoreBlock({
  label,
  hint,
  value,
  votes,
  distribution,
  consensus,
  locale,
}: {
  label: string;
  hint: string;
  value: number | null;
  votes: number;
  distribution: MapRatingSummary["overallDistribution"];
  consensus?: RatingConsensus | null;
  locale: string;
}) {
  const { t: tLabel } = await getTranslation("components/labels", locale);
  const { t } = await getTranslation(
    "components/maps/detail/community/verdict",
    locale,
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <span className="text-xs text-fd-muted-foreground">{hint}</span>
      </div>
      <div className="flex items-center gap-3">
        <StarValue value={value} className="text-3xl" />
        <div className="flex flex-col gap-1">
          <Stars value={value} size={18} />
          <span className="text-xs text-fd-muted-foreground tabular-nums">
            {t(votes === 1 ? "votes-one" : "votes", {
              count: numberFormat(locale, INT_FORMAT).format(votes),
            })}
            {/* Said out loud rather than left in the standard deviation: a 3.0
              everyone agrees on and a 3.0 half the server fought over are
              different facts about the map, and on a map the second is the
              common case. */}
            {consensus ? (
              <>
                {" "}
                &middot; {tLabel(`rating-consensus.${consensus}`).toLowerCase()}
              </>
            ) : null}
          </span>
        </div>
      </div>
      <StarHistogram bars={distribution} locale={locale} />
    </div>
  );
}

async function NoVotesYet({ locale }: { locale: string }) {
  const { t } = await getTranslation(
    "components/maps/detail/community/verdict",
    locale,
  );
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium">{t("nobody-has-rated-this-map")}</p>
      <p className="text-sm text-fd-muted-foreground">{t("if-you-play-here")}</p>
    </div>
  );
}
