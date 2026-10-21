"use client";

import { Interpolate } from "@/components/interpolate";
import { toRoman } from "roman-numerals";
import { useStatsPeriod } from "@/hooks/use-period";
import { useTierFloor } from "@/hooks/use-tier-floor";
import { useTranslation } from "@/hooks/use-translation";
import { useFormat } from "@/hooks/use-format";
import {
  RATING_METRICS,
  StrongholdPeriod,
  TOP_PLAYERS_MIN_BATTLES,
} from "@unicum.gg/shared";

/** The metric named in a sentence, one span per metric, CSS showing one. */
function MetricInline() {
  const { t } = useTranslation("components/players/list/view");
  return (
    <>
      {RATING_METRICS.map((m) => (
        <span key={m} data-rating-col={m}>
          {t(m)}
        </span>
      ))}
    </>
  );
}

/**
 * The player landing's intro sentence, which says what the board below ranks
 * and over how many battles, so it follows the window picked in the board's
 * title, as the stronghold board's blurb does.
 *
 * The prerendered page is the lifetime board, so the server's sentence is the
 * lifetime one and a recent window swaps it in after hydration, exactly when
 * the board under it swaps its rows.
 */
export function TopPlayersIntro({
  variant,
  region,
  language,
}: {
  variant: "all" | "language" | "strict";
  region: string;
  language: string;
}) {
  const { t } = useTranslation("components/players/list/view");
  const { t: tGame } = useTranslation("game/vocabulary");
  const { num } = useFormat();
  const [period] = useStatsPeriod();
  const [tier] = useTierFloor();
  const template =
    period === StrongholdPeriod.Overall
      ? t(`intro.${variant}`, { region, language })
      : t(`intro-period.${variant}`, {
          region,
          language,
          period: tGame(`stronghold-periods.${period}`),
          tier: toRoman(tier),
          battles: num({ maximumFractionDigits: 0 }).format(
            TOP_PLAYERS_MIN_BATTLES[period],
          ),
        });
  // The metric is a picker, not a word, so it rides the sentence as a node:
  // half the languages we publish put it somewhere else.
  return <Interpolate template={template} values={{ metric: <MetricInline /> }} />;
}
