"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GlossaryLabel } from "@/components/glossary/label";
import { RatingBandName } from "@/components/rating-band-name";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  RATING_COLOR_CLASS,
  RatingColor,
  RatingScale,
  RatingScaleUnit,
  ratingScale,
  TankBattleMode,
  type RatingScaleBand,
} from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";
import { tankModeName } from "@/components/game-name";

type TierRow = {
  color: RatingColor;
  /** Key into the shared rating scale's tier words. */
  tier: string;
  wr: string;
  mr: string;
};

/** The band words, darkest to brightest, matching the ascending thresholds. */
const TIER_KEY: Record<RatingColor, string> = {
  [RatingColor.VeryBad]: "very-bad",
  [RatingColor.Bad]: "bad",
  [RatingColor.BelowAvg]: "below-avg",
  [RatingColor.Average]: "average",
  [RatingColor.Good]: "good",
  [RatingColor.VeryGood]: "very-good",
  [RatingColor.Super]: "super",
  [RatingColor.Excellent]: "excellent",
  [RatingColor.Top]: "top",
};

/**
 * One band as a range, with the upper edge exclusive so two rows never print
 * the same number. The lowest band is written as an open "<x" rather than as
 * "0-x", since a rating of zero is not a thing a reader holds.
 */
function range(band: RatingScaleBand, lowest: boolean, unit: RatingScaleUnit): string {
  const suffix = unit === RatingScaleUnit.Percent ? "%" : "";
  const n = (v: number) =>
    unit === RatingScaleUnit.Percent ? Math.round(v) : v;
  if (lowest || band.from === null) return `<${n(band.to ?? 0)}${suffix}`;
  if (band.to === null) return `\u2265${n(band.from)}${suffix}`;
  return `${n(band.from)}-${n(band.to) - 1}${suffix}`;
}

// Derived from the colour functions by bisection rather than copied, which is
// what `ratingScale` exists for: the thresholds are written once, in `mrColor`
// and `modeWinrateColor`, and a table repeating them here is a table to keep in
// sync, quietly mislabelling a published scale the day one of them moves. It
// was a hand-kept copy until the Rampage rename moved both ladders at once,
// which is the drift this removes.
//
// The win-rate column is anchored on the mode's own 42.2% median rather than
// 50%: Rampage's battles were multi-team, so one team of several won and the
// population cannot average half.
const TIERS: TierRow[] = (() => {
  const wr = ratingScale(RatingScale.RampageWinrate);
  const mr = ratingScale(RatingScale.Mr);
  // Both ladders have one band per colour and share their order, so they zip
  // by index. Reversed, because the table reads best band first.
  return mr.bands
    .map((band, i) => ({
      color: band.color,
      tier: TIER_KEY[band.color],
      wr: range(wr.bands[i], i === 0, wr.unit),
      mr: range(band, i === 0, mr.unit),
    }))
    .reverse();
})();

/** Color thresholds for the Rampage board: win rate and MR. */
export function RampageRatingScale() {
  const { t } = useTranslation("components/players/list/rampage/view");
  const { t: tOwn } = useTranslation("components/players/list/rampage/rating-scale");
  // The band words are the site's own scale, shared with the home page's: one
  // vocabulary for the colours, wherever they are shown.
  const { t: tScale } = useTranslation("components/home/rating-scale");
  const { t: tGame } = useTranslation("game/vocabulary");
  const mode = tankModeName(TankBattleMode.Fallout, tGame);
  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        {t("scale-description", { mode })}
      </div>
      <div className="mt-auto">
        <Table className="mb-px! [&_td]:min-w-0! [&_th]:min-w-0! [&_tr]:h-11">
          <TableHeader>
            <TableRow>
              {/* The rows are the colour bands, not vehicle tiers. */}
              <TableHead className="pl-4!">
                <GlossaryLabel label={tOwn("rating-colors")}>{tScale("tier")}</GlossaryLabel>
              </TableHead>
              <TableHead className="text-right!">
                <GlossaryLabel>{tOwn("wr")}</GlossaryLabel>
              </TableHead>
              <TableHead className="pr-4 text-right!">
                <GlossaryLabel>{tOwn("mr")}</GlossaryLabel>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TIERS.map((band) => (
              <TableRow key={band.color}>
                <TableCell
                  className={cn(
                    // Wraps on a phone, like the home page's own scale: held
                    // on one line, the longest translation of a band name
                    // widens the column past the table and gives the panel a
                    // horizontal scroll over nothing. The figures beside it
                    // still never break.
                    "pl-4! font-semibold sm:whitespace-nowrap",
                    RATING_COLOR_CLASS[band.color],
                  )}
                >
                  <RatingBandName color={band.color}>{tScale(`tiers.${band.tier}`)}</RatingBandName>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {band.wr}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {band.mr}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
