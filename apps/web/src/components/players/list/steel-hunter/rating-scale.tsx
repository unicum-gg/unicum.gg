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
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { RATING_COLOR_CLASS, RatingColor } from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";
import { battleTypeName } from "@/components/game-name";
import { BattleType } from "@unicum.gg/shared";

type TierRow = {
  color: RatingColor;
  /** Key into the shared rating scale's tier words. */
  tier: string;
  wr: string;
  hr: string;
  hrb: string;
};

// Mirrors the SH color scales in @unicum.gg/shared: `steelHunterWinrateColor`
// (WR, top-5 placement baseline ~41%), `hrColor` (HR) and `hrbColor` (HRB).
// Kept in sync by hand, like the home page's RatingScale.
const TIERS: TierRow[] = [
  { color: RatingColor.Top,       tier: "top",       wr: "≥58%",   hr: "≥1720",     hrb: "≥2500" },
  { color: RatingColor.Excellent, tier: "excellent", wr: "53-57%", hr: "1620-1719", hrb: "2350-2499" },
  { color: RatingColor.Super,     tier: "super",     wr: "49-52%", hr: "1500-1619", hrb: "2000-2349" },
  { color: RatingColor.VeryGood,  tier: "very-good", wr: "46-48%", hr: "1300-1499", hrb: "1520-1999" },
  { color: RatingColor.Good,      tier: "good",      wr: "43-45%", hr: "1070-1299", hrb: "1120-1519" },
  { color: RatingColor.Average,   tier: "average",   wr: "39-42%", hr: "820-1069",  hrb: "795-1119" },
  { color: RatingColor.BelowAvg,  tier: "below-avg", wr: "37-38%", hr: "680-819",   hrb: "645-794" },
  { color: RatingColor.Bad,       tier: "bad",       wr: "35-36%", hr: "550-679",   hrb: "520-644" },
  { color: RatingColor.VeryBad,   tier: "very-bad",  wr: "<35%",   hr: "<550",      hrb: "<520" },
];

/** Color thresholds for the Steel Hunter board: win rate, HR and HRB. */
export function SteelHunterRatingScale() {
  const { t } = useTranslation("components/players/list/steel-hunter/view");
  const { t: tOwn } = useTranslation("components/players/list/steel-hunter/rating-scale");
  // The band words are the site's own scale, shared with the home page's: one
  // vocabulary for the colours, wherever they are shown.
  const { t: tScale } = useTranslation("components/home/rating-scale");
  const { t: tGame } = useTranslation("game/vocabulary");
  const mode = battleTypeName(BattleType.BattleRoyale, tGame);
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
              <TableHead className="text-right!">
                <GlossaryLabel>{tOwn("hr")}</GlossaryLabel>
              </TableHead>
              <TableHead className="pr-4 text-right!">
                <GlossaryLabel>{tOwn("hrb")}</GlossaryLabel>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TIERS.map((band) => (
              <TableRow key={band.color}>
                <TableCell
                  className={cn(
                    "pl-4! font-semibold whitespace-nowrap",
                    RATING_COLOR_CLASS[band.color],
                  )}
                >
                  {tScale(`tiers.${band.tier}`)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {band.wr}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {band.hr}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {band.hrb}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
