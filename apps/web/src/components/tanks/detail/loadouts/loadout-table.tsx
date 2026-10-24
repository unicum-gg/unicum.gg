"use client";

import { Fragment, useState } from "react";
import {
  MIN_ROW_PERFORMANCE_SAMPLE,
  RATING_COLOR_CLASS,
  RATING_METRIC_LABEL,
  RATING_METRICS,
  RatingMetric,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import { Hint } from "@/components/hint";
import { useRatingMetric } from "@/components/tournaments/detail/team-rating";
import {
  LoadoutSlotBox,
  LoadoutTooltips,
} from "@/components/players/detail/tanks/loadout-boxes";
import {
  SortDirection,
  SortableHead,
  type SortState,
} from "@/components/tanks/sortable-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormat } from "@/hooks/use-format";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { LoadoutTableRow } from "./view";

/**
 * What the players fit, as one dense sortable table: the setup as pictures,
 * then how it is used and how the battles fitted with it went.
 *
 * A set is drawn as its pictures alone, with each name on hover: a line of
 * three device names beside them made every row a sentence and the table a
 * list. A row of a single item (a crew skill, a directive) shows its name
 * beside the picture, since there is room and nothing to crowd.
 *
 * Each measure comes as a pair and a difference: the figure with this setup,
 * the same players' overall figure across their account, and the gap. A
 * setup's own win rate means little alone, because the players who chose it
 * bring their own skill to it; the gap says how the setup plays against how
 * good its players are in general. It is still a correlation, and nothing here
 * is worded as more.
 *
 * Every row shows its figures, however few players stand behind it. Where the
 * table mixes rows over and under `MIN_ROW_PERFORMANCE_SAMPLE`, the thin ones
 * are drawn muted and say why on hover: a table full of holes reads as broken,
 * where a muted row reads as "this rests on very few people", which is the
 * truth.
 */

enum Column {
  Usage = "usage",
  Battles = "battles",
  Damage = "damage",
  Assist = "assist",
  Winrate = "winrate",
  PlayerWinrate = "playerWinrate",
  WinrateDelta = "winrateDelta",
}

/** The sort keys of one rating metric's three columns. */
const ratingKey = (metric: RatingMetric, part: "value" | "usual" | "delta") =>
  `${metric}:${part}`;

const RATING_COLOR: Record<RatingMetric, (value: number) => string> = {
  [RatingMetric.Wn7]: (value) => RATING_COLOR_CLASS[wn7Color(value)],
  [RatingMetric.Wn8]: (value) => RATING_COLOR_CLASS[wn8Color(value)],
  [RatingMetric.Wnx]: (value) => RATING_COLOR_CLASS[wnxColor(value)],
};

const PCT = { style: "percent", maximumFractionDigits: 1 } as const;
const PCT_DELTA = {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
} as const;
const INT = { maximumFractionDigits: 0 } as const;
const INT_DELTA = { maximumFractionDigits: 0, signDisplay: "exceptZero" } as const;

const DASH = "—";

/** The box edge: the largest that sits inside the board's 44px row. */
const BOX = 32;

const gap = (value: number | null, usual: number | null) =>
  value == null || usual == null ? null : value - usual;

function sortValue(row: LoadoutTableRow, key: string): number {
  const p = row.performance;
  const or = (value: number | null) => value ?? -Infinity;
  const [metric, part] = key.split(":") as [RatingMetric, string | undefined];
  if (part) {
    const value = p.rating[metric];
    const usual = p.playerRating[metric];
    return or(part === "value" ? value : part === "usual" ? usual : gap(value, usual));
  }
  switch (key) {
    case Column.Battles:
      return row.battles;
    case Column.Damage:
      return or(p.avgDamage);
    case Column.Assist:
      return or(p.avgAssist);
    case Column.Winrate:
      return or(p.winrate);
    case Column.PlayerWinrate:
      return or(p.playerWinrate);
    case Column.WinrateDelta:
      return or(gap(p.winrate, p.playerWinrate));
    default:
      return row.count * 1e6 + p.battles;
  }
}

export function LoadoutTable({
  rows,
  sample,
  confident,
  labels,
}: {
  rows: LoadoutTableRow[];
  sample: number;
  /** Whether the sample is big enough for a share to lead each row. */
  confident: boolean;
  labels: Record<
    | "build"
    | "usage"
    | "battles"
    | "damage"
    | "assist"
    | "winrate"
    | "playerWinrate"
    | "playerRating"
    | "delta"
    | "deltaTip"
    | "playerWinrateTip"
    | "playerRatingTip"
    | "usageTip"
    | "thin",
    string
  >;
}) {
  const { num } = useFormat();
  const metric = useRatingMetric();
  // Null until the reader clicks a heading. The default is the question the
  // table is for, which setup does best, read on the metric picked in the
  // navbar, so it follows that pick rather than being frozen at first render.
  const [picked, setPicked] = useState<SortState>(null);
  const sort: SortState = picked ?? {
    key: ratingKey(metric, "value"),
    direction: SortDirection.Desc,
  };
  // Fading only marks a row against the others. When none has enough players
  // behind it, every row would fade together into a dimmer copy of the same
  // table, and the tab's note already says the whole sample is small.
  const mixed = rows.some((row) => row.count >= MIN_ROW_PERFORMANCE_SAMPLE);
  const isThin = (row: LoadoutTableRow) =>
    mixed && row.count < MIN_ROW_PERFORMANCE_SAMPLE;

  // Ranked on a figure, a setup one player ran once would head the table on a
  // single good battle. So where the table mixes solid rows with thin ones,
  // the solid ones are ranked first and the thin ones after them, each group
  // in the order asked for. Not memoized by hand: the React Compiler does it.
  const factor = sort.direction === SortDirection.Asc ? 1 : -1;
  const byPerformance = sort.key !== Column.Usage && sort.key !== Column.Battles;
  const sorted = [...rows].sort((a, b) => {
    if (byPerformance && isThin(a) !== isThin(b)) return isThin(a) ? 1 : -1;
    return factor * (sortValue(a, sort.key) - sortValue(b, sort.key));
  });

  const toggle = (key: string) =>
    setPicked(
      sort.key === key
        ? {
            key,
            direction:
              sort.direction === SortDirection.Desc
                ? SortDirection.Asc
                : SortDirection.Desc,
          }
        : { key, direction: SortDirection.Desc },
    );

  if (rows.length === 0) return null;
  const usualLabel = (metric: RatingMetric) =>
    labels.playerRating.replace("{metric}", RATING_METRIC_LABEL[metric]);
  const head = (
    col: string,
    label: string,
    extra?: Partial<React.ComponentProps<typeof SortableHead>>,
  ) => (
    <SortableHead
      col={col}
      state={sort}
      onToggle={toggle}
      align="end"
      headClassName="w-px whitespace-nowrap"
      {...extra}
    >
      {label}
    </SortableHead>
  );

  const delta = (
    value: number | null,
    format: Intl.NumberFormatOptions,
    className?: string,
    ratingCol?: string,
  ) => (
    <TableCell
      data-rating-col={ratingCol}
      className={cn(
        "text-right font-medium tabular-nums whitespace-nowrap",
        className,
        value == null || value === 0
          ? "text-fd-muted-foreground"
          : value > 0
            ? "text-emerald-500"
            : "text-red-500",
      )}
    >
      {value == null ? DASH : num(format).format(value)}
    </TableCell>
  );

  return (
    <LoadoutTooltips>
      <Table rail className="mb-px! [&_tr]:h-11">
        <TableHeader>
          <TableRow>
            <TableHead className="ps-4! whitespace-nowrap">{labels.build}</TableHead>
            {head(Column.Usage, labels.usage, { tooltip: labels.usageTip })}
            {head(Column.Battles, labels.battles)}
            {head(Column.Damage, labels.damage, { hideOnMobile: true })}
            {head(Column.Assist, labels.assist, { hideOnMobile: true })}
            {head(Column.Winrate, labels.winrate)}
            {head(Column.PlayerWinrate, labels.playerWinrate, {
              hideOnMobile: true,
              tooltip: labels.playerWinrateTip,
            })}
            {head(Column.WinrateDelta, labels.delta, { tooltip: labels.deltaTip })}
            {/* One trio per rating metric, all three rendered and only the
                one picked in the navbar shown, by the site's own
                cookie-painted CSS, as every other rating column does. */}
            {RATING_METRICS.map((metric) => (
              <Fragment key={metric}>
                {head(ratingKey(metric, "value"), RATING_METRIC_LABEL[metric], {
                  ratingCol: metric,
                })}
                {head(ratingKey(metric, "usual"), usualLabel(metric), {
                  ratingCol: metric,
                  hideOnMobile: true,
                  tooltip: labels.playerRatingTip,
                })}
                {head(ratingKey(metric, "delta"), labels.delta, {
                  ratingCol: metric,
                  tooltip: labels.deltaTip,
                  headClassName: "w-px whitespace-nowrap pr-4",
                })}
              </Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const p = row.performance;
            const thin = isThin(row);
            const usage = confident
              ? num(PCT).format(row.share)
              : `${row.count}/${sample}`;
            return (
              <TableRow
                key={row.key}
                // Only the figures fade, never the setup: what was fitted is a
                // fact at any size, what it did is the part a handful of
                // players cannot carry.
                className={cn(thin && "[&>td:not(:first-child)]:opacity-50")}
              >
                <TableCell className="py-1.5 ps-4!">
                  <span className="flex items-center gap-1">
                    {row.icons.map((icon, index) => (
                      <LoadoutSlotBox key={index} slot={icon} size={BOX} />
                    ))}
                    {/* A row of one item (a crew skill, a directive) has the
                        room for its name, and the name is what tells two
                        similar pictures apart. A set keeps its pictures alone:
                        three names side by side made each row a sentence. */}
                    {row.icons.length === 1 ? (
                      <span className="ms-2 truncate text-sm text-fd-muted-foreground">
                        {row.icons[0]!.name}
                      </span>
                    ) : null}
                  </span>
                </TableCell>

                <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                  {thin ? (
                    <Hint content={labels.thin} as="span">
                      {usage}
                    </Hint>
                  ) : (
                    usage
                  )}
                </TableCell>

                <Figure value={row.battles} format={INT} />
                <Figure value={p.avgDamage} format={INT} hideOnMobile />
                <Figure value={p.avgAssist} format={INT} hideOnMobile />
                <Painted
                  value={p.winrate}
                  text={p.winrate == null ? DASH : num(PCT).format(p.winrate)}
                  color={(v) => RATING_COLOR_CLASS[winrateColor(v)]}
                />
                <Painted
                  value={p.playerWinrate}
                  text={p.playerWinrate == null ? DASH : num(PCT).format(p.playerWinrate)}
                  color={(v) => RATING_COLOR_CLASS[winrateColor(v)]}
                  hideOnMobile
                />
                {delta(gap(p.winrate, p.playerWinrate), PCT_DELTA)}
                {RATING_METRICS.map((metric) => {
                  const value = p.rating[metric];
                  const usual = p.playerRating[metric];
                  return (
                    <Fragment key={metric}>
                      <Painted
                        value={value}
                        text={value == null ? DASH : num(INT).format(value)}
                        color={RATING_COLOR[metric]}
                        ratingCol={metric}
                      />
                      <Painted
                        value={usual}
                        text={usual == null ? DASH : num(INT).format(usual)}
                        color={RATING_COLOR[metric]}
                        ratingCol={metric}
                        hideOnMobile
                      />
                      {delta(gap(value, usual), INT_DELTA, "pr-4", metric)}
                    </Fragment>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </LoadoutTooltips>
  );
}

/** A plain figure, muted like the board's own. */
function Figure({
  value,
  format,
  hideOnMobile,
  ratingCol,
}: {
  value: number | null;
  format: Intl.NumberFormatOptions;
  hideOnMobile?: boolean;
  ratingCol?: string;
}) {
  const { num } = useFormat();
  return (
    <TableCell
      data-rating-col={ratingCol}
      className={cn(
        "text-right tabular-nums whitespace-nowrap text-fd-muted-foreground",
        hideOnMobile && styles.hiddenColumn,
      )}
    >
      {value == null ? DASH : num(format).format(value)}
    </TableCell>
  );
}

/** A rating figure, painted in its band like the board's rating column. */
function Painted({
  value,
  text,
  color,
  ratingCol,
  hideOnMobile,
}: {
  value: number | null;
  text: string;
  color: (value: number) => string;
  ratingCol?: string;
  hideOnMobile?: boolean;
}) {
  return (
    <TableCell
      data-rating-col={ratingCol}
      className={cn(
        "text-right font-semibold tabular-nums whitespace-nowrap",
        hideOnMobile && styles.hiddenColumn,
        value == null ? "text-fd-muted-foreground" : color(value),
      )}
    >
      {text}
    </TableCell>
  );
}
