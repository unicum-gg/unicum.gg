"use client";

import { useLocale } from "@onruntime/translations/react";
import { tankParamName } from "@/components/game-name";
import { tankHeadingKey } from "@/lib/tank-params";
import { useTranslation } from "@/hooks/use-translation";

import type { ReactNode } from "react";
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import type { TankSpec } from "@unicum.gg/shared";
import type { SpecRanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-ranges";
import { CurrencyIcon } from "@/components/tanks/currency-icon";
import {
  GROUPS,
  type Group,
  type Row,
} from "@/components/tanks/detail/specifications/characteristics/rows";
import {
  deltaColor,
  formatSpecValue,
  isBetter,
  hiddenRowIndexes,
  rowDelta,
  specValue,
  type SpecColumn,
} from "@/components/tanks/detail/specifications/characteristics/format";
import { categoryScore, MAX_SCORE } from "@/components/tanks/compare/score";
import { bestOf } from "@/components/compare/cells";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";

/** A column of the comparison, the same shape a tank page's own table reads. */
export type CompareColumnSpecs = SpecColumn;

/** The indices holding the best value of a row, respecting its direction and
 * judged at the precision the row prints. A neutral row has nothing to win (a
 * bigger calibre is not "better"), so nothing is marked on one. */
function bestIndices(values: (number | null)[], row: Row): Set<number> {
  if (row.neutral) return new Set();
  const digits = row.digits ?? 0;
  return bestOf(values, {
    lowerBetter: row.lowerBetter,
    same: (a, b) => a.toFixed(digits) === b.toFixed(digits),
  });
}

/**
 * One value, and the two things the comparison says about it.
 *
 * **Colour says one thing only: how this reads against the reference column.**
 * Green is better than it, red is worse, and the reference itself is left plain
 * because it is the point everything is measured from rather than a competitor.
 * It used to say two: the value went green for winning its row while the little
 * delta beside it went green or red against the reference, so one row could
 * carry both greens meaning different things, and a column could be green with
 * nothing red facing it (nothing marks "lost a row", and the reference carries
 * no delta at all, so it can never be red). Unpinning every column leaves the
 * table with no colour, which is the honest answer: with no reference there is
 * nothing for a colour to mean.
 *
 * **Weight says the other: who holds the best value of the row.** It earns its
 * own channel because at three or four columns it is not derivable from the
 * colours, and it must not be an ink that already means something else.
 *
 * The arrow carries the judgement, not the sign of the subtraction: the `+` and
 * `-` already say which way the number moved, so pointing the arrow the same way
 * doubled that and contradicted the colour instead, a longer reload rising in
 * red. Pointing it at better/worse doubles the colour, which is what a reader
 * who cannot separate green from red needs.
 */
function ValueCell({
  value,
  row,
  specs,
  isBest,
  reference,
}: {
  value: number | null;
  row: Row;
  specs: TankSpec | null;
  isBest: boolean;
  /** The pinned column's value for this row, or null on the pinned column
   * itself and when nothing is pinned. */
  reference: number | null;
}) {
  const { locale } = useLocale();
  if (value == null) {
    return <span className="text-fd-muted-foreground">—</span>;
  }
  // Same delta and same colouring the tank page shows against stock, read
  // against the pinned column instead.
  const delta = rowDelta(value, reference, row);
  const better = isBetter(value, reference, row);
  const color = deltaColor(value, reference, row);
  const secondary = row.secondary ? specs?.[row.secondary] : null;
  return (
    <span className="inline-flex items-baseline justify-end gap-1.5 whitespace-nowrap">
      {delta != null && (
        <span className={cn("inline-flex items-center text-[0.6875rem]", color)}>
          {delta > 0 ? "+" : ""}
          {formatSpecValue(locale, delta, row.digits)}
          {better ? (
            <TrendUpIcon className="size-3" weight="bold" />
          ) : (
            <TrendDownIcon className="size-3" weight="bold" />
          )}
        </span>
      )}
      <span className={cn("font-medium", isBest && "font-semibold", color)}>
        {formatSpecValue(locale, value, row.digits)}
        {typeof secondary === "number" && (
          <span className="text-fd-muted-foreground/70">
            {" / "}
            {formatSpecValue(locale, secondary, row.digits)}
          </span>
        )}
        {row.currency ? (
          <CurrencyIcon
            type={row.currency}
            className="ml-1 inline-block h-3 w-auto translate-y-px text-fd-muted-foreground"
          />
        ) : row.unit ? (
          <span className="ml-0.5 text-xs text-fd-muted-foreground">
            {row.unit}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The comparison itself: the game's Compare Vehicles table, one column per
 * vehicle over the same characteristics the tank page lists.
 *
 * Every column reads a live build, so a mounted rammer or a trained crew moves
 * the numbers here exactly as it does on a tank page. Rows carry their own sense
 * of better (a lower reload wins, a bigger caliber wins nothing), which is what
 * marks the best value; the pinned column turns the others into differences
 * against it, the way the game shows a delta against the vehicle you picked.
 */
export function TankCompareGrid({
  columns,
  ranges,
  pinned,
  headers,
  labelWidth = "12rem",
}: {
  columns: CompareColumnSpecs[];
  ranges: SpecRanges;
  /** Index of the reference column, or null to show plain values everywhere. */
  pinned: number | null;
  /** One header cell per column, built by the caller (it holds the builds). */
  headers: ReactNode[];
  labelWidth?: string;
}) {
  // The horizontal scroll is only offered where it is needed (narrow screens):
  // a scroll container becomes the sticky header's containing block, so from
  // `lg`, where the table fits, the page itself scrolls and the vehicles stay in
  // view as the characteristics go by.
  return (
    <div className="overflow-x-auto lg:overflow-x-visible">
      <table className="screen-line-after-cell w-full min-w-2xl table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: labelWidth }} />
          {columns.map((_, i) => (
            <col key={i} />
          ))}
        </colgroup>
        {/* The vehicles follow the scroll: a full characteristics table is far
            taller than a screen, and a number means nothing once the column it
            belongs to has scrolled off. */}
        {/* The background sits on the cells, not on `thead`: a table section's
            own background is painted under the cells, so a scrolled row would
            show through the sticky header. */}
        <thead className="sticky top-14 z-20">
          <tr className="border-b border-fd-border align-top">
            <th className="sticky left-0 bg-fd-background p-0" />
            {/* The column rule is an inset shadow rather than a border: with
                `border-collapse` a border belongs to the table, not the cell, so
                the cell background does not extend under it and the coloured
                rows scrolling beneath this sticky header showed straight through
                the translucent line. */}
            {headers.map((header, i) => (
              <th
                key={i}
                className="bg-fd-background p-0 text-left font-normal shadow-[inset_1px_0_0_var(--color-fd-border)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        {GROUPS.map((group) => (
          <SpecGroupRows
            key={group.title}
            group={group}
            columns={columns}
            ranges={ranges}
            pinned={pinned}
          />
        ))}
      </table>
    </div>
  );
}

function SpecGroupRows({
  group,
  columns,
  ranges,
  pinned,
}: {
  group: Group;
  columns: CompareColumnSpecs[];
  ranges: SpecRanges;
  pinned: number | null;
}) {
  const { t } = useTranslation("components/tanks/compare/characteristics-grid");
  // The same catalogue the detail page reads its headings from, so the two
  // tables cannot name a group differently.
  const { t: tParams } = useTranslation("game/tank-params");
  const heading = tankParamName(tankHeadingKey(group.title), group.title, tParams);
  const hidden = hiddenRowIndexes(group, columns);
  const scores = columns.map((c) => categoryScore(c.specs, group, ranges));
  // Read exactly like the rows under it: colour against the reference column,
  // weight for the best of the row. A score is plain higher-is-better and whole,
  // so it needs none of a row's direction or precision to be judged.
  const best = bestOf(scores);
  const referenceScore = pinned != null ? scores[pinned] : null;

  return (
    <tbody className="border-b border-fd-border last:border-b-0">
      <tr className="border-b border-fd-border bg-fd-secondary/30">
        <th className="sticky left-0 bg-fd-secondary px-4 py-2 text-left text-sm font-semibold tracking-wide uppercase">
          {heading}
        </th>
        {scores.map((score, i) => (
          <Hint
            key={i}
            content={t("score-tip", {
              group: heading.toLowerCase(),
              max: MAX_SCORE,
            })}
          >
            <td className="border-l border-fd-border px-3 py-2 text-right tabular-nums">
              {score == null ? (
                <span className="text-fd-muted-foreground">—</span>
              ) : (
                <span
                  className={cn(
                    "font-semibold",
                    best.has(i) && "font-bold",
                    pinned !== i &&
                      referenceScore != null &&
                      score !== referenceScore &&
                      (score > referenceScore
                        ? "text-emerald-500"
                        : "text-red-500"),
                  )}
                >
                  {score}
                </span>
              )}
            </td>
          </Hint>
        ))}
      </tr>
      {group.rows.map((row, index) => {
        if (hidden.has(index)) return null;
        if (row.header) {
          return (
            <tr key={index} className="border-b border-fd-border/60">
              <th
                colSpan={columns.length + 1}
                className="px-4 pt-2 pb-1 text-left text-sm font-medium"
              >
                {/* A cell spanning the whole row has no room to stick, so the
                    label inside it is what stays put on a sideways scroll. */}
                <span className="sticky left-4 inline-block">{tankParamName(row.key ?? tankHeadingKey(row.label), row.label, tParams)}</span>
              </th>
            </tr>
          );
        }
        const values = columns.map((c) =>
          c.specs ? specValue(c.specs, row, c.baseline) : null,
        );
        const best = bestIndices(values, row);
        const reference = pinned != null ? values[pinned] : null;
        return (
          <tr
            key={index}
            className="border-b border-fd-border/60 last:border-b-0 hover:bg-fd-secondary/20"
          >
            {/* Sticky, so the characteristic being read stays on screen while
                the columns scroll sideways on a narrow display. */}
            <td
              className={cn(
                "sticky left-0 bg-fd-background px-4 py-1.5 text-fd-muted-foreground",
                row.sub && "pl-7 text-fd-muted-foreground/75",
              )}
            >
              {tankParamName(row.key ?? tankHeadingKey(row.label), row.label, tParams)}
            </td>
            {values.map((value, i) => {
              const isPinned = pinned === i;
              return (
                <td
                  key={i}
                  className={cn(
                    "border-l border-fd-border px-3 py-1.5 text-right tabular-nums",
                    isPinned && "bg-fd-secondary/20",
                  )}
                >
                  <ValueCell
                    value={value}
                    row={row}
                    specs={columns[i].specs}
                    isBest={best.has(i)}
                    reference={isPinned ? null : reference}
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
}
