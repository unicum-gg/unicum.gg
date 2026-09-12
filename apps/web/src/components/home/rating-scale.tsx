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
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import {
  RATING_COLOR_CLASS,
  RatingColor,
} from "@unicum.gg/shared";

type TierRow = {
  color: RatingColor;
  /** The band's key in `components/home/rating-scale`, not its wording. */
  id: string;
  wr: string;
  wn7: string;
  wn8: string;
  wnx: string;
};

const TIERS: TierRow[] = [
  { color: RatingColor.Top,       id: "top",        wr: "≥65%",   wn7: "≥2050",     wn8: "≥2900",     wnx: "≥2800" },
  { color: RatingColor.Excellent, id: "excellent",  wr: "60–64%", wn7: "1850–2049", wn8: "2350–2899", wnx: "2200–2799" },
  { color: RatingColor.Super,     id: "super",      wr: "56–59%", wn7: "1550–1849", wn8: "1900–2349", wnx: "1800–2199" },
  { color: RatingColor.VeryGood,  id: "very-good",  wr: "54–55%", wn7: "1350–1549", wn8: "1600–1899", wnx: "1600–1799" },
  { color: RatingColor.Good,      id: "good",       wr: "52–53%", wn7: "1100–1349", wn8: "1250–1599", wnx: "1200–1599" },
  { color: RatingColor.Average,   id: "average",    wr: "49–51%", wn7: "900–1099",  wn8: "900–1249",  wnx: "800–1199" },
  { color: RatingColor.BelowAvg,  id: "below-avg",  wr: "47–48%", wn7: "700–899",   wn8: "600–899",   wnx: "400–799" },
  { color: RatingColor.Bad,       id: "bad",        wr: "45–46%", wn7: "500–699",   wn8: "300–599",   wnx: "200–399" },
  { color: RatingColor.VeryBad,   id: "very-bad",   wr: "<45%",   wn7: "<500",      wn8: "<300",      wnx: "<200" },
];

/**
 * A Client Component although it fetches nothing: it is a static table rendered
 * on three different pages, and reading the language off the context is what
 * saves every one of them from threading it down.
 */
/** The panel heading the scale sits under, on all three pages that show it. */
export function RatingScaleTitle() {
  const { t } = useTranslation("components/home/rating-scale");
  return <>{t("title")}</>;
}

export function RatingScale() {
  const { t } = useTranslation("components/home/rating-scale");

  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        {t("description")}
      </div>
      <div className="mt-auto">
        <Table className="mb-px! [&_td]:min-w-0! [&_th]:min-w-0! [&_tr]:h-11">
          <TableHeader>
            <TableRow>
              {/* The rows are the colour bands, not vehicle tiers, so the
                  heading is anchored on what it lists. */}
              <TableHead className="pl-4!">
                <GlossaryLabel label={t("rating-colors")}>{t("tier")}</GlossaryLabel>
              </TableHead>
              <TableHead className="text-right!">
                <GlossaryLabel>{t("wr")}</GlossaryLabel>
              </TableHead>
              <TableHead data-rating-col="wn7" className="text-right!">
                <GlossaryLabel>{t("wn7")}</GlossaryLabel>
              </TableHead>
              <TableHead data-rating-col="wn8" className="text-right!">
                <GlossaryLabel>{t("wn8")}</GlossaryLabel>
              </TableHead>
              <TableHead data-rating-col="wnx" className="pr-4 text-right!">
                <GlossaryLabel>{t("wnx")}</GlossaryLabel>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TIERS.map((row) => {
              const colorClass = RATING_COLOR_CLASS[row.color];
              return (
                <TableRow key={row.color}>
                  <TableCell
                    className={cn(
                      "pl-4! font-semibold whitespace-nowrap",
                      colorClass,
                    )}
                  >
                    {t(`tiers.${row.id}`)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {row.wr}
                  </TableCell>
                  <TableCell
                    data-rating-col="wn7"
                    className="text-right tabular-nums text-muted-foreground whitespace-nowrap"
                  >
                    {row.wn7}
                  </TableCell>
                  <TableCell
                    data-rating-col="wn8"
                    className="text-right tabular-nums text-muted-foreground whitespace-nowrap"
                  >
                    {row.wn8}
                  </TableCell>
                  <TableCell
                    data-rating-col="wnx"
                    className="pr-4 text-right tabular-nums text-muted-foreground whitespace-nowrap"
                  >
                    {row.wnx}
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
