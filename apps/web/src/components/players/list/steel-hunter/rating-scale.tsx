import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { RATING_COLOR_CLASS, RatingColor } from "@unicum.gg/shared";

type TierRow = {
  color: RatingColor;
  label: string;
  wr: string;
  hr: string;
  hrb: string;
};

// Mirrors the SH color scales in @unicum.gg/shared: `steelHunterWinrateColor`
// (WR, top-5 placement baseline ~41%), `hrColor` (HR) and `hrbColor` (HRB).
// Kept in sync by hand, like the home page's RatingScale.
const TIERS: TierRow[] = [
  { color: RatingColor.Top,       label: "Top",       wr: "≥58%",   hr: "≥1720",     hrb: "≥2500" },
  { color: RatingColor.Excellent, label: "Excellent", wr: "53-57%", hr: "1620-1719", hrb: "2350-2499" },
  { color: RatingColor.Super,     label: "Super",     wr: "49-52%", hr: "1500-1619", hrb: "2000-2349" },
  { color: RatingColor.VeryGood,  label: "Very good", wr: "46-48%", hr: "1300-1499", hrb: "1520-1999" },
  { color: RatingColor.Good,      label: "Good",      wr: "43-45%", hr: "1070-1299", hrb: "1120-1519" },
  { color: RatingColor.Average,   label: "Average",   wr: "39-42%", hr: "820-1069",  hrb: "795-1119" },
  { color: RatingColor.BelowAvg,  label: "Below avg", wr: "37-38%", hr: "680-819",   hrb: "645-794" },
  { color: RatingColor.Bad,       label: "Bad",       wr: "35-36%", hr: "550-679",   hrb: "520-644" },
  { color: RatingColor.VeryBad,   label: "Very bad",  wr: "<35%",   hr: "<550",      hrb: "<520" },
];

/** Color thresholds for the Steel Hunter board: win rate, HR and HRB. */
export function SteelHunterRatingScale() {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        Color thresholds for the Steel Hunter board, calibrated on the population
        of players with at least 100 Steel Hunter battles.
      </div>
      <div className="mt-auto">
        <Table className="mb-px! [&_td]:min-w-0! [&_th]:min-w-0! [&_tr]:h-11">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4!">Tier</TableHead>
              <TableHead className="text-right!">WR</TableHead>
              <TableHead className="text-right!">HR</TableHead>
              <TableHead className="pr-4 text-right!">HRB</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TIERS.map((t) => (
              <TableRow key={t.color}>
                <TableCell
                  className={cn(
                    "pl-4! font-semibold whitespace-nowrap",
                    RATING_COLOR_CLASS[t.color],
                  )}
                >
                  {t.label}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {t.wr}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {t.hr}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {t.hrb}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
