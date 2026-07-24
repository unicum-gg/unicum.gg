"use client";

import { Period, PERIOD_LABEL, isPeriod } from "@/hooks/use-period";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The inline period select rendered in a panel title. Presentational: the
 * owning panel holds the cookie-backed value (via `usePeriod`) so it can pick
 * the right dataset and toggle the "See all" link. Styled to blend into the
 * `text-xl font-semibold` title, with a negative margin so it does not grow the
 * header line box.
 */
export function PeriodSelect({
  period,
  onChange,
}: {
  period: Period;
  onChange: (next: Period) => void;
}) {
  return (
    <Select
      value={period}
      onValueChange={(v) => {
        if (isPeriod(v)) onChange(v);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Leaderboard period"
        className="-my-1 inline-flex! h-7! gap-1 px-1.5! py-0! align-middle text-xl! font-semibold [&_svg]:size-4"
      >
        <SelectValue>{PERIOD_LABEL[period]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.values(Period).map((p) => (
          <SelectItem key={p} value={p}>
            {PERIOD_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
