"use client";

import { useTranslation } from "@/hooks/use-translation";
import { STRONGHOLD_PERIOD_LABEL } from "@unicum.gg/shared";
import { PeriodInlineSelect } from "@/components/period-inline-select";
import { STATS_PERIODS, useStatsPeriod } from "@/hooks/use-period";

/**
 * Which window a stats table shows, for the screens that can only show one.
 *
 * A phone has room for the stat names and one column of figures. The table used
 * to answer that by dropping 24h and 7d outright, which made those two windows
 * unreachable on a phone rather than merely off screen. This picks the one
 * column instead, so nothing is out of reach, and the stat names get back the
 * width the other three were taking (a label as ordinary as "World of Tanks
 * Rating" broke onto four lines).
 *
 * Renders the separator with it, and takes both away from `sm` up, where the
 * table draws all four windows at once and there is nothing left to choose: it
 * is the narrow screen's way of reading the same table, not a filter over it.
 * (The hiding is on this wrapper rather than on the trigger, whose `inline-flex`
 * is `!important` and would win over a plain `sm:hidden`.)
 */
export function StatsPeriodSelect() {
  const { t } = useTranslation("components/stats-period-select");
  // Wargaming's own words for the windows, from `game/vocabulary`: the
  // constant is the English source and the key side, like every other
  // catalogue lookup on the site.
  const { t: tGame } = useTranslation("game/vocabulary");
  const [period, setPeriod] = useStatsPeriod();
  return (
    <span className="sm:hidden">
      {" · "}
      <PeriodInlineSelect
        period={period}
        periods={STATS_PERIODS}
        label={(p) => {
          const name = tGame(`stronghold-periods.${p}`);
          return name === `stronghold-periods.${p}` ? STRONGHOLD_PERIOD_LABEL[p] : name;
        }}
        onChange={setPeriod}
        ariaLabel={t("stats-period")}
      />
    </span>
  );
}
