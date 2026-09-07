"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * The site's period select: a dropdown that sits inside a panel title, reading
 * as part of the sentence rather than as a control beside it ("Top players ·
 * Overall", "Animal's random battles stats · Past 30 days").
 *
 * Presentational, like the rest of the site's selectors: the owning panel holds
 * the value, because it is usually the thing that also needs it (a leaderboard
 * keys its fetch on it, a stats table decides its columns from it).
 *
 * Generic over the window set, because the panels do not agree on one: the home
 * boards offer Overall and 30d, the stronghold board and the stats tables all
 * four. It was written three times before this, once per set, and the three
 * copies of the trigger's styling are what made a change to it a change in
 * three files.
 */
export function PeriodInlineSelect<T extends string>({
  period,
  periods,
  label,
  onChange,
  ariaLabel = "Period",
  className,
}: {
  period: T;
  periods: readonly T[];
  /** How a window is named in the title and the menu. */
  label: (period: T) => string;
  onChange: (next: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Select
      value={period}
      // Checked against the offered set rather than cast. What comes back is
      // whatever the trigger reports, and the value goes straight into a cookie
      // every other panel on the site reads: the two-window home select guarded
      // it with `isPeriod` before this was extracted, and the guard should not
      // be what the extraction lost.
      onValueChange={(v) => {
        if ((periods as readonly string[]).includes(v)) onChange(v as T);
      }}
    >
      {/* Sized and negatively margined to blend into the `text-xl font-semibold`
          title without growing its line box. */}
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className={cn(
          "-my-1 inline-flex! h-7! gap-1 px-1.5! py-0! align-middle text-xl! font-semibold [&_svg]:size-4",
          className,
        )}
      >
        <SelectValue>{label(period)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {periods.map((p) => (
          <SelectItem key={p} value={p}>
            {label(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
