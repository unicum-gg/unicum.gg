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
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import {
  RATING_COLOR_CLASS,
  RATING_METRICS,
  RatingColor,
  RatingMetric,
  RatingScale as Scale,
  type RatingScaleBand,
  ratingScale,
} from "@unicum.gg/shared";

/** The bands top first, each with its key in `components/home/rating-scale`. */
const BANDS: { color: RatingColor; id: string }[] = [
  { color: RatingColor.Top, id: "top" },
  { color: RatingColor.Excellent, id: "excellent" },
  { color: RatingColor.Super, id: "super" },
  { color: RatingColor.VeryGood, id: "very-good" },
  { color: RatingColor.Good, id: "good" },
  { color: RatingColor.Average, id: "average" },
  { color: RatingColor.BelowAvg, id: "below-avg" },
  { color: RatingColor.Bad, id: "bad" },
  { color: RatingColor.VeryBad, id: "very-bad" },
];

/** The published scale behind each metric's column. */
const METRIC_SCALE: Record<RatingMetric, Scale> = {
  [RatingMetric.Wn7]: Scale.Wn7,
  [RatingMetric.Wn8]: Scale.Wn8,
  [RatingMetric.Wnx]: Scale.Wnx,
  [RatingMetric.Pr]: Scale.Pr,
  [RatingMetric.Wtr]: Scale.Wtr,
};

/**
 * One band's range as the table prints it: "≥2900", "<300", "1900–2349".
 *
 * Read off the published scale (`ratingScale`) rather than typed out here,
 * which is what this table used to be: a second copy of every threshold on the
 * site, waiting for one of them to move. Every edge is a whole number on every
 * scale shown, so a band's last value is the next band's edge minus one.
 */
function rangeOf(band: RatingScaleBand | undefined, unit = ""): string {
  if (!band) return "—";
  if (band.to === null) return `≥${band.from}${unit}`;
  if (band.from === null || band.from <= 0) return `<${band.to}${unit}`;
  return `${band.from}–${band.to - 1}${unit}`;
}

function bandsByColor(scale: Scale): Map<RatingColor, RatingScaleBand> {
  return new Map(ratingScale(scale).bands.map((band) => [band.color, band]));
}

const WINRATE_BANDS = bandsByColor(Scale.Winrate);
const METRIC_BANDS = new Map(
  RATING_METRICS.map((metric) => [metric, bandsByColor(METRIC_SCALE[metric])]),
);

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
              {RATING_METRICS.map((metric) => (
                <TableHead
                  key={metric}
                  data-rating-col={metric}
                  className="pr-4 text-right!"
                >
                  <GlossaryLabel>{t(metric)}</GlossaryLabel>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {BANDS.map((row) => {
              const colorClass = RATING_COLOR_CLASS[row.color];
              return (
                <TableRow key={row.color}>
                  <TableCell
                    className={cn(
                      // The band's name may break on a phone. Kept on one
                      // line, the longest translation of it ("En dessous de
                      // la moyenne") holds the column at 214px of a 388px
                      // table and gave the panel 16px of horizontal scroll
                      // over nothing. The figures beside it still never
                      // break: a range split across two lines is unreadable.
                      "pl-4! font-semibold sm:whitespace-nowrap",
                      colorClass,
                    )}
                  >
                    <RatingBandName color={row.color}>{t(`tiers.${row.id}`)}</RatingBandName>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {rangeOf(WINRATE_BANDS.get(row.color), "%")}
                  </TableCell>
                  {RATING_METRICS.map((metric) => (
                    <TableCell
                      key={metric}
                      data-rating-col={metric}
                      className="pr-4 text-right tabular-nums text-muted-foreground whitespace-nowrap"
                    >
                      {rangeOf(METRIC_BANDS.get(metric)?.get(row.color))}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
