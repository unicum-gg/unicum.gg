"use client";

import { Period } from "@/hooks/use-period";
import { useTranslation } from "@/hooks/use-translation";
import { PeriodInlineSelect } from "@/components/period-inline-select";

const PERIODS = Object.values(Period);

/**
 * The inline period select rendered in a panel title. Presentational: the
 * owning panel holds the cookie-backed value (via `usePeriod`) so it can pick
 * the right dataset and toggle the "See all" link.
 *
 * Two windows where the stronghold board and the stats tables offer four, which
 * is the only thing this adds over `PeriodInlineSelect`: the home panels rank on
 * overall and 30d alone.
 */
export function PeriodSelect({
  period,
  onChange,
}: {
  period: Period;
  onChange: (next: Period) => void;
}) {
  const { t } = useTranslation("components/home/period-select");

  return (
    <PeriodInlineSelect
      period={period}
      periods={PERIODS}
      label={(p) => t(`periods.${p}`)}
      onChange={onChange}
      ariaLabel={t("label")}
    />
  );
}
