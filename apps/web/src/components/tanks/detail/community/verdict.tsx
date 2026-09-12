import { numberFormat } from "@/lib/format";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import {
  type RatingConsensus,
  type TankRatingSummary,
} from "@unicum.gg/shared";
import { Stars, StarValue } from "./stars";
import { StarHistogram } from "./histogram";

const INT_FORMAT = {} as const;

/**
 * The headline: what the community makes of this tank, and how much weight that
 * carries.
 *
 * The two figures sit side by side because they answer different questions and
 * regularly disagree. A tank can be strong and joyless, or bad and beloved, and
 * a single score would average those into a number that describes neither.
 *
 * The line under them is the part no other community average prints: the mean
 * number of battles the voters have on the tank. That is the difference between
 * a verdict and a poll.
 */
export async function CommunityVerdict({
  summary, locale,
}: {
  summary: TankRatingSummary;
  locale: string;
}) {
  const { t } = await getTranslation("components/tanks/detail/community/verdict", locale);
  if (summary.votes === 0) return <NoVotesYet locale={locale} />;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <ScoreBlock
        locale={locale}
        label={t("overall")}
        hint={t("how-good-the-tank-is")}
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
        {summary.avgVoterBattles == null ? (
          t("every-vote-played")
        ) : (
          <Interpolate
            template={t("every-vote-played-average")}
            values={{
              battles: (
                <span className="font-medium text-fd-foreground tabular-nums">
                  {numberFormat(locale, INT_FORMAT).format(Math.round(summary.avgVoterBattles))}
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
  distribution: TankRatingSummary["overallDistribution"];
  consensus?: RatingConsensus | null;
  locale: string;
}) {
  const { t: tLabel } = await getTranslation("components/labels", locale);
  const { t } = await getTranslation(
    "components/tanks/detail/community/verdict",
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
              different facts about the tank. */}
            {consensus ? (
              <> &middot; {tLabel(`rating-consensus.${consensus}`).toLowerCase()}</>
            ) : null}
          </span>
        </div>
      </div>
      <StarHistogram bars={distribution}  locale={locale} />
    </div>
  );
}

async function NoVotesYet({ locale }: { locale: string }) {
  const { t } = await getTranslation("components/tanks/detail/community/verdict", locale);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium">{t("nobody-has-rated-this-tank")}</p>
      <p className="text-sm text-fd-muted-foreground">
        {t("if-you-have-played-it")}</p>
    </div>
  );
}
