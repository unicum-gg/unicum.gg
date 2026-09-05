"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toRoman } from "roman-numerals";
import type { PlayerTankRow } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { unicum } from "@/services/sdk";
import { cn } from "@/lib/utils";

/**
 * A tier-by-level count of how many vehicles sit at each mark or badge.
 *
 * Built on the profile's own stats table rather than as a chart of its own: the
 * same fixed columns, cell borders and right-aligned tabular numerals, so it
 * reads as another block of the record instead of a visualisation dropped into
 * it. The colour lives in the column headers, which carry the mark and badge
 * icons used everywhere else on the site, so the grid stays as quiet as the
 * table above it.
 *
 * Every count is a link into the Tanks tab with that tier and level already
 * selected, and hovering one names the vehicles behind it. The names come from
 * the tanks endpoint, which is not fetched until the first hover and is keyed
 * on the same URL the Tanks tab uses, so opening the tab afterwards reuses the
 * response instead of asking again.
 */

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Vehicles named in the hover before it falls back to counting the rest. */
const PREVIEW_LIMIT = 8;

// Keyed by the caller's own level names, so the keys in `levels` and the
// fields in `counts` are checked against each other: renaming a field in
// `MasteryTierRow` without renaming the level would otherwise compile and
// silently render a column of dashes.
export type MatrixLevel<K extends string> = {
  key: K;
  /** Column heading, the level's own icon. */
  label: React.ReactNode;
  /** The level itself (0 for none), both for the link and to pick the
   * vehicles out of the garage. */
  value: number;
};

export type MatrixRow<K extends string> = {
  tier: number;
  total: number;
  counts: Record<K | "none", number>;
};

export function MarksMatrix<K extends string>({
  region,
  nickname,
  tanksHref,
  rows,
  levels,
  emptyLabel,
  /** Query parameter the Tanks tab filters this level on. */
  param,
  /** Reads the level off a vehicle, to name the ones behind a count. */
  levelOf,
}: {
  region: Region;
  nickname: string;
  tanksHref: string;
  rows: MatrixRow<K>[];
  levels: MatrixLevel<K>[];
  emptyLabel: string;
  param: "moe" | "mom";
  levelOf: (tank: PlayerTankRow) => number | null;
}) {
  // Armed by the first hover, never on mount: the panel is above the fold on
  // every profile and this list is a few hundred rows.
  const [armed, setArmed] = useState(false);
  const request = () => unicum.region(region).players(nickname).tanks();
  const { data: tanks } = useSWR(
    // The same key the Tanks tab uses, so whichever asks first serves both.
    armed ? request().url() : null,
    () => request().then((r) => r.tanks as unknown as PlayerTankRow[]),
  );

  if (rows.length === 0) return null;
  const columns: MatrixLevel<K | "none">[] = [
    { key: "none", label: emptyLabel, value: 0 },
    ...levels,
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <Table className="my-0! table-fixed [&_td]:min-w-0 [&_td]:py-0.5! [&_th]:py-1! [&_tr>*+*]:border-l [&_tr>*:first-child]:pl-4! [&_tr>*]:border-border">
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            {columns.map((c) => (
              <TableHead key={c.key} className="text-right">
                <span className="inline-flex items-center justify-end">
                  {c.label}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.tier}>
              <TableCell className="py-1.5! font-medium">
                {toRoman(row.tier)}
              </TableCell>
              {columns.map((c) => {
                const count = row.counts[c.key] ?? 0;
                if (count === 0) {
                  return (
                    <TableCell
                      key={c.key}
                      className="py-1.5! text-right tabular-nums text-muted-foreground"
                    >
                      —
                    </TableCell>
                  );
                }
                return (
                  <TableCell
                    key={c.key}
                    className="p-0! text-right tabular-nums"
                    onMouseEnter={() => setArmed(true)}
                    onFocus={() => setArmed(true)}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`${tanksHref}?tier=${row.tier}&${param}=${c.value}`}
                          className="block px-2 py-1.5 hover:bg-fd-secondary/40"
                        >
                          {count}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64">
                        <CellPreview
                          tanks={tanks}
                          tier={row.tier}
                          level={c.value}
                          levelOf={levelOf}
                          count={count}
                        />
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

/** The vehicles behind one count, heaviest first so the ones the player
 * actually drives lead. */
function CellPreview({
  tanks,
  tier,
  level,
  levelOf,
  count,
}: {
  tanks: PlayerTankRow[] | undefined;
  tier: number;
  level: number;
  levelOf: (tank: PlayerTankRow) => number | null;
  count: number;
}) {
  if (!tanks) {
    return (
      <span className="text-xs">
        {intFmt.format(count)} tier {toRoman(tier)}{" "}
        {count === 1 ? "vehicle" : "vehicles"}, loading their names…
      </span>
    );
  }

  const matching = tanks
    .filter((t) => t.tier === tier && levelOf(t) === level)
    .sort((a, b) => b.battles - a.battles);
  const shown = matching.slice(0, PREVIEW_LIMIT);
  const rest = matching.length - shown.length;

  return (
    <div className="text-xs">
      <ul className={cn(shown.length > 1 && "space-y-0.5")}>
        {shown.map((t) => (
          <li key={t.tankId} className="flex items-baseline justify-between gap-3">
            <span className="truncate">{t.shortName ?? t.name}</span>
            <span className="shrink-0 tabular-nums opacity-70">
              {intFmt.format(t.battles)}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <p className="mt-1 opacity-70">and {intFmt.format(rest)} more</p>
      )}
      <p className="mt-1 opacity-70">Click to open them in the Tanks tab</p>
    </div>
  );
}
