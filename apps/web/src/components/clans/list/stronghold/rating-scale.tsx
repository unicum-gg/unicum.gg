import { statLabel } from "@/components/stat-label";
import { useTranslation } from "@/hooks/use-translation";
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
  strongholdScaleRanges,
} from "@unicum.gg/shared";

// Win-rate ranges of `strongholdWinrateColor` (50%-anchored, unlike random's
// scale). Kept in sync with that function.
const WR_RANGE: Record<RatingColor, string> = {
  [RatingColor.Top]: "≥65%",
  [RatingColor.Excellent]: "60-64%",
  [RatingColor.Super]: "55-59%",
  [RatingColor.VeryGood]: "53-54%",
  [RatingColor.Good]: "50-52%",
  [RatingColor.Average]: "45-49%",
  [RatingColor.BelowAvg]: "40-44%",
  [RatingColor.Bad]: "35-39%",
  [RatingColor.VeryBad]: "<35%",
};

const TIER_LABEL: Record<RatingColor, string> = {
  [RatingColor.Top]: "Top",
  [RatingColor.Excellent]: "Excellent",
  [RatingColor.Super]: "Super",
  [RatingColor.VeryGood]: "Very good",
  [RatingColor.Good]: "Good",
  [RatingColor.Average]: "Average",
  [RatingColor.BelowAvg]: "Below avg",
  [RatingColor.Bad]: "Bad",
  [RatingColor.VeryBad]: "Very bad",
};

/** Color thresholds for the stronghold board: win rate, SR and SRB. One
 * absolute scale for every tier, like WNX, so a value means the same everywhere. */
export function StrongholdRatingScale() {
  const { t: tCopy } = useTranslation("components/clans/list/stronghold/rating-scale");
  const { t } = useTranslation("components/clans/list/stronghold/rating-scale");
  const { t: tLocal } = useTranslation("components/clans/list/stronghold/rating-scale");
  const rows = strongholdScaleRanges();
  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        {tCopy("color-thresholds-for-the-stronghold")}</div>
      <div className="mt-auto">
        <Table className="mb-px! [&_td]:min-w-0! [&_th]:min-w-0! [&_tr]:h-11">
          <TableHeader>
            <TableRow>
              {/* The rows are the colour bands, not vehicle tiers. */}
              <TableHead className="pl-4!">
                <GlossaryLabel label={t("rating-colors")}>{t("tier")}</GlossaryLabel>
              </TableHead>
              <TableHead className="text-right!">
                <GlossaryLabel>{t("wr")}</GlossaryLabel>
              </TableHead>
              <TableHead className="text-right!">
                <GlossaryLabel>{t("sr")}</GlossaryLabel>
              </TableHead>
              <TableHead className="pr-4 text-right!">
                <GlossaryLabel>{t("srb")}</GlossaryLabel>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.color}>
                <TableCell
                  className={cn(
                    // Wraps on a phone, like the home page's own scale: held
                    // on one line, the longest translation of a band name
                    // widens the column past the table and gives the panel a
                    // horizontal scroll over nothing. The figures beside it
                    // still never break.
                    "pl-4! font-semibold sm:whitespace-nowrap",
                    RATING_COLOR_CLASS[r.color],
                  )}
                >
                  <RatingBandName color={r.color}>{statLabel(TIER_LABEL[r.color], tLocal)}</RatingBandName>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {WR_RANGE[r.color]}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {r.sr}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {r.srb}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
