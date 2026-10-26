"use client";

import { toRoman } from "roman-numerals";
import {
  RATING_COLOR_CLASS,
  winrateColor,
  type MapGroupStats,
  type MapRecordBaseline,
} from "@unicum.gg/shared";
import { Hint } from "@/components/hint";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

/**
 * How each vehicle class, or each tier, does on this map, beside the same
 * vehicles everywhere else.
 *
 * Every figure carries its gap to the baseline under it, because the figure
 * alone mostly says which vehicles were played: a TD class averaging 2,000
 * damage is a strong map for TDs only if the same TDs average less elsewhere.
 * That gap is the part about the map, and it is what a reader scans for, so
 * it is coloured while the figure stays plain.
 *
 * Not sortable: five classes and ten tiers read best in their natural order,
 * and a reader comparing classes compares the whole row anyway.
 */

/** Classes in the order the game lists them. */
const CLASS_ORDER = ["heavyTank", "mediumTank", "lightTank", "AT-SPG", "SPG"];

type MetricKey = keyof MapRecordBaseline;

const PCT = { style: "percent", maximumFractionDigits: 1 } as const;
const PCT_DELTA = {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
} as const;
const INT = { maximumFractionDigits: 0 } as const;
const INT_DELTA = { maximumFractionDigits: 0, signDisplay: "exceptZero" } as const;
const DEC = { maximumFractionDigits: 2 } as const;
const DEC_DELTA = { maximumFractionDigits: 2, signDisplay: "exceptZero" } as const;

const DASH = "—";

/** Each column: which figure, how it is written, and whether it hides on a
 * phone. The win rate is painted in its band instead of carrying a gap: the
 * matchmaker balances the teams, so a class's win rate on a map sits near the
 * same vehicles' everywhere and the gap would be noise. */
const COLUMNS: {
  key: MetricKey;
  label: "damage" | "assist" | "kills" | "spotted" | "survival" | "xp";
  format: Intl.NumberFormatOptions;
  delta: Intl.NumberFormatOptions;
  hideOnMobile?: boolean;
}[] = [
  { key: "avgDamage", label: "damage", format: INT, delta: INT_DELTA },
  { key: "avgAssist", label: "assist", format: INT, delta: INT_DELTA, hideOnMobile: true },
  { key: "avgKills", label: "kills", format: DEC, delta: DEC_DELTA, hideOnMobile: true },
  { key: "avgSpotted", label: "spotted", format: DEC, delta: DEC_DELTA, hideOnMobile: true },
  { key: "survival", label: "survival", format: PCT, delta: PCT_DELTA },
  { key: "avgXp", label: "xp", format: INT, delta: INT_DELTA, hideOnMobile: true },
];

export function MapGroupTable({
  kind,
  rows,
  records,
  labels,
}: {
  kind: "class" | "tier";
  rows: MapGroupStats[];
  /** The map's vehicle records, which each row's share is over. */
  records: number;
  labels: Record<
    | "group"
    | "records"
    | "recordsTip"
    | "winrate"
    | "damage"
    | "assist"
    | "kills"
    | "spotted"
    | "survival"
    | "xp"
    | "baselineTip",
    string
  >;
}) {
  const { num } = useFormat();
  const { t: tClasses } = useTranslation("game/vehicle-classes");

  const ordered =
    kind === "class"
      ? [...rows].sort(
          (a, b) => CLASS_ORDER.indexOf(a.key) - CLASS_ORDER.indexOf(b.key),
        )
      : rows;

  return (
    <div className="overflow-x-auto">
      <Table className="my-0! [&_td]:py-1.5! [&_th]:whitespace-nowrap [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
        <TableHeader>
          <TableRow>
            <TableHead>{labels.group}</TableHead>
            <TableHead className="w-px text-right">
              <Hint content={labels.recordsTip} as="span">
                {labels.records}
              </Hint>
            </TableHead>
            <TableHead className="w-px text-right">
              {labels.winrate}
            </TableHead>
            {COLUMNS.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "w-px text-right",
                  column.hideOnMobile && styles.hiddenColumn,
                )}
              >
                <Hint content={labels.baselineTip} as="span">
                  {labels[column.label]}
                </Hint>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map((row) => {
            const { stats, baseline } = row;
            return (
              <TableRow key={row.key}>
                <TableCell className="font-medium whitespace-nowrap">
                  {kind === "class" ? (
                    <span className="flex items-center gap-2">
                      <VehicleTypeIcon type={row.key} />
                      {tClasses(row.key)}
                    </span>
                  ) : (
                    toRoman(Number(row.key))
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">
                  <span className="font-medium">{num(INT).format(stats.records)}</span>{" "}
                  <span className="text-xs text-fd-muted-foreground">
                    {num(PCT).format(records > 0 ? stats.records / records : 0)}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums whitespace-nowrap",
                    stats.winrate == null
                      ? "text-fd-muted-foreground"
                      : RATING_COLOR_CLASS[winrateColor(stats.winrate)],
                  )}
                >
                  {stats.winrate == null ? DASH : num(PCT).format(stats.winrate)}
                </TableCell>
                {COLUMNS.map((column) => {
                  const value = stats[column.key];
                  const usual = baseline[column.key];
                  const gap = value == null || usual == null ? null : value - usual;
                  return (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "text-right tabular-nums whitespace-nowrap",
                        column.hideOnMobile && styles.hiddenColumn,
                      )}
                    >
                      <span className="block font-medium">
                        {value == null ? DASH : num(column.format).format(value)}
                      </span>
                      {gap == null ? null : (
                        <span
                          className={cn(
                            "block text-xs",
                            gap === 0
                              ? "text-fd-muted-foreground"
                              : gap > 0
                                ? "text-emerald-500"
                                : "text-red-500",
                          )}
                        >
                          {num(column.delta).format(gap)}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
