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
import {
  RATING_COLOR_CLASS,
  RatingColor,
} from "@/services/wargaming/wot/ratings";

type TierRow = {
  color: RatingColor;
  label: string;
  wr: string;
  wn7: string;
  wn8: string;
};

const TIERS: TierRow[] = [
  { color: RatingColor.Top, label: "Top", wr: "≥65%", wn7: "≥2050", wn8: "≥2900" },
  { color: RatingColor.Excellent, label: "Excellent", wr: "60–64%", wn7: "1850–2049", wn8: "2350–2899" },
  { color: RatingColor.Super, label: "Super", wr: "56–59%", wn7: "1550–1849", wn8: "1900–2349" },
  { color: RatingColor.VeryGood, label: "Very good", wr: "54–55%", wn7: "1350–1549", wn8: "1600–1899" },
  { color: RatingColor.Good, label: "Good", wr: "52–53%", wn7: "1100–1349", wn8: "1250–1599" },
  { color: RatingColor.Average, label: "Average", wr: "49–51%", wn7: "900–1099", wn8: "900–1249" },
  { color: RatingColor.BelowAvg, label: "Below avg", wr: "47–48%", wn7: "700–899", wn8: "600–899" },
  { color: RatingColor.Bad, label: "Bad", wr: "45–46%", wn7: "500–699", wn8: "300–599" },
  { color: RatingColor.VeryBad, label: "Very bad", wr: "<45%", wn7: "<500", wn8: "<300" },
];

export function RatingScale() {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        Color thresholds used across the site for win rate, WN7 and WN8 / WNX
        ratings.
      </div>
      <div className="mt-auto">
        <Table className="mb-px! [&_td]:min-w-0 [&_tr]:h-11">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4!">Tier</TableHead>
          <TableHead className="text-right!">WR</TableHead>
          <TableHead className="text-right!">WN7</TableHead>
          <TableHead className="pr-4 text-right!">WN8 / WNX</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {TIERS.map((t) => {
          const colorClass = RATING_COLOR_CLASS[t.color];
          return (
            <TableRow key={t.color}>
              <TableCell
                className={cn(
                  "pl-4! font-semibold whitespace-nowrap",
                  colorClass,
                )}
              >
                {t.label}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                {t.wr}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                {t.wn7}
              </TableCell>
              <TableCell className="pr-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                {t.wn8}
              </TableCell>
            </TableRow>
          );
        })}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
