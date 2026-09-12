import { numberFormat } from "@/lib/format";
import {
  RATING_COLOR_HEX,
  starRatingColor,
  type StarDistribution,
} from "@unicum.gg/shared";

const INT_FORMAT = {} as const;

/**
 * The shape of the vote, five bars, best at the top.
 *
 * Printed next to the average rather than behind a toggle because the average
 * hides the one thing worth knowing about a contested tank. Two vehicles both
 * sitting at 3.2 can be a wall of threes or a pile at one and a pile at five,
 * and only the second is a tank whose reputation depends on who is driving it.
 *
 * Each bar is painted at the colour its own score would earn, so the weight of
 * a distribution is readable before any of the numbers are.
 */
export function StarHistogram({ bars, locale }: { bars: StarDistribution[] ; locale: string }) {
  const total = bars.reduce((sum, b) => sum + b.votes, 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {bars.map((bar) => (
        <div key={bar.stars} className="flex items-center gap-2 text-xs">
          <span className="w-3 text-right text-fd-muted-foreground tabular-nums">
            {bar.stars}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-sm bg-fd-border/60">
            <div
              className="h-full rounded-sm"
              style={{
                // Share of the vote, computed server-side so the bar and the
                // count can never disagree.
                width: `${bar.share * 100}%`,
                backgroundColor: RATING_COLOR_HEX[starRatingColor(bar.stars)],
              }}
            />
          </div>
          <span className="w-10 text-right text-fd-muted-foreground tabular-nums">
            {numberFormat(locale, INT_FORMAT).format(bar.votes)}
          </span>
        </div>
      ))}
    </div>
  );
}
