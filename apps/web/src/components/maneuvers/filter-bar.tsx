"use client";

import { ManeuversSort } from "@unicum.gg/shared";
import type { FilterSubject } from "@/components/filter-subject";
import type { useManeuversRows } from "@/components/maneuvers/use-board-rows";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import type { LeaderboardFilters } from "@/hooks/use-leaderboard-filter";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The leaderboards' own filter row (search, then a min/max window on a column
 * the reader picks), driven by the endpoint rather than by a list held here:
 * a Maneuvers board is paged on the server, so a filter has to run there to
 * reach past the page on screen. Same component as every other board, so the
 * row reads the same everywhere.
 */
export function ManeuversFilterBar({
  rows,
  subject,
  ranked,
  measured,
}: {
  rows: ReturnType<typeof useManeuversRows>;
  subject: FilterSubject;
  /** The whole board, which the result count is read against. */
  ranked: number;
  /** Whether the 24h columns exist yet, and so whether they can be bounded. */
  measured: boolean;
}) {
  const { t } = useTranslation("components/players/list/maneuvers/view");
  const { t: tCols } = useTranslation("components/maneuvers/columns");
  // The values are the endpoint's to read; the bar only needs the keys and
  // the labels, so each column hands it a placeholder getter.
  const none = () => null;
  const rangeCols = [
    { key: ManeuversSort.FamePoints, label: t("fame-points"), value: none },
    ...(measured
      ? [
          { key: ManeuversSort.Gain, label: tCols("gain"), value: none },
          { key: ManeuversSort.Move, label: tCols("move"), value: none },
        ]
      : []),
  ];
  const filters: LeaderboardFilters<unknown> = {
    query: rows.query,
    ...rows.filters,
    rangeCols,
    activeRangeCol: rangeCols.find((c) => c.key === rows.filters.rangeCol),
    resultCount: rows.total,
    totalCount: ranked,
  };
  return (
    <div className="border-b border-fd-border px-4 py-2.5">
      <LeaderboardFilterBar filters={filters} searchNoun={subject} />
    </div>
  );
}
