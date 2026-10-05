"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toRoman } from "roman-numerals";
import { useFormat } from "@/hooks/use-format";
import { PlayerName } from "@/components/entity/player-name";
import { identityFromRow } from "@/components/entity/player-identity";
import { FilterSubject } from "@/components/filter-subject";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { RankingColumnHead } from "@/components/ranking-column-head";
import { RankMedal } from "@/components/rank-medal";
import { TablePager, usePagination } from "@/components/table-pager";
import PAGINATION from "@/constants/pagination";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import {
  DEFAULT_MARKS_SORT,
  isMarksSort,
  MARKS_SORT_TOTAL,
  markCountAtTier,
  marksSortForTier,
  RATING_COLOR_CLASS,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import { unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

// Mirror the API contract (PLAYERS_TOP_MAX_LIMIT): pull the whole ranking and
// paginate client-side. Kept local so this client component does not drag the
// server-side schemas module into the browser bundle.
const MAX_ROWS = 1000;

/**
 * Tier columns kept on a narrow screen, counted from the top of the list.
 *
 * Which tiers those are is the data's business, not this component's: the list
 * arrives ascending, so the last entries are the top tiers whatever the game
 * decides they are, and tier XI became one of them by existing.
 */
const TIERS_ON_MOBILE = 3;

/** One row of the Marks of Excellence board, as `/players/marks` answers it. */
export type MarksRow = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  marks3: number;
  marks3_by_tier: number[];
  marks2: number;
  marks1: number;
  known: number;
  measured_at: string;
  languages: string[];
  is_verified?: boolean;
  is_supporter?: boolean;
  twitch_login?: string | null;
  tournament_wins?: number;
  tournament_featured_wins?: number;
  tournament_best_title?: string | null;
  onslaught_best_tier?: string | null;
  onslaught_best_rank?: number | null;
  onslaught_seasons?: number;
};

/**
 * The reader's rating, as three cells of which CSS shows one.
 *
 * The rating boards mount themselves once per metric and let `data-rating-col`
 * pick, which is what keeps their prerendered HTML the same for every visitor
 * whatever their cookie says. Mounting this whole table three times would
 * triple a board whose subject is not the rating at all, so the gating moves
 * down to the cell: all three ship and one is shown.
 *
 * It has to be the CELL and not a span inside it, which is what this was first
 * and what looked wrong. `RATING_COLOR_CLASS` is a BACKGROUND meant to fill a
 * cell edge to edge, and every rating column on the site is drawn that way, so
 * the colours stack into one continuous band down the table. A block span only
 * ever grows to its own content, so on a row made taller by anything else (a
 * player name carrying crests, which is most of them) the colour stopped short
 * of the row's edges and the band came apart into floating chips with gaps
 * between them.
 *
 * Hiding is `display: none`, so the two cells that are not shown leave the row
 * entirely and the one that is lines up with the one heading drawn above it.
 */
function RatingCells({ row }: { row: MarksRow }) {
  const { num } = useFormat();
  const values: Array<[string, number | null, (v: number) => string]> = [
    ["wn7", row.wn7, (v) => RATING_COLOR_CLASS[wn7Color(v)]],
    ["wn8", row.wn8, (v) => RATING_COLOR_CLASS[wn8Color(v)]],
    ["wnx", row.wnx, (v) => RATING_COLOR_CLASS[wnxColor(v)]],
  ];
  return (
    <>
      {values.map(([metric, value, colorOf]) => (
        <TableCell
          key={metric}
          data-rating-col={metric}
          className={cn(
            // `pr-4` on each of them rather than through the table's
            // `td:last-child` rule: that selector still names the wnx cell when
            // the reader is on wn7, so the padding would land on a cell nobody
            // can see and the visible one would run into the table's edge.
            "pr-4! text-right font-semibold tabular-nums",
            value == null ? "text-muted-foreground" : colorOf(value),
          )}
        >
          {value == null ? "—" : num(INT_FORMAT).format(value)}
        </TableCell>
      ))}
    </>
  );
}

/**
 * Who holds the most guns with three Marks of Excellence.
 *
 * Every column ranks a different population, which is why a header click
 * re-fetches instead of reordering: a player with three hundred low-tier marks
 * leads the total and is nowhere near the tier X column. Same mechanism as the
 * Steel Hunter board, including the `?sort=` deep link the static page can only
 * read after mount.
 *
 * The tier columns come from `tiers`, which the endpoint derives from the rows,
 * so a tier the game gains becomes a column the day somebody marks a gun at it
 * and nothing here holds a list to keep in step.
 */
export function MarksBoard({
  region,
  initialResults,
  tiers,
  language,
  strict,
  page,
}: {
  region: Region;
  initialResults: MarksRow[];
  /** Tiers anybody on the board holds a three-mark gun at, ascending. */
  tiers: number[];
  /** The language view this board is of, so a re-fetch keeps the filter. */
  language: string | null;
  strict: boolean;
  /** The page this render is of, from the route's own `/page/[n]` segment. */
  page?: number;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/list/marks/board");
  const { t: tView } = useTranslation("components/players/list/view");
  // The mark levels are Wargaming's own words and are already written down per
  // language, so they are read straight from the catalogue rather than being a
  // string of ours: a label that is nothing but a name has one right answer,
  // and asking a model for it is how a board comes to head a column with a
  // synonym of what the reader's own client says. The tiers are Roman numerals,
  // which every language we publish spells the same way.
  const { t: tGame } = useTranslation("game/vocabulary");

  const [sort, setSort] = useState<string>(DEFAULT_MARKS_SORT);
  const [results, setResults] = useState(initialResults);
  const [loading, setLoading] = useState(false);

  const searchFields = useCallback(
    (r: MarksRow) => [r.nickname, r.clan_tag],
    [],
  );
  const rangeCols = useMemo<RangeColumn<MarksRow>[]>(
    () => [
      { key: "marks3", label: tGame("marks.3"), value: (r) => r.marks3 },
      ...tiers.map((tier) => ({
        key: `tier${tier}`,
        label: t("tier", { tier: toRoman(tier) }),
        value: (r: MarksRow) => markCountAtTier(r.marks3_by_tier, tier),
      })),
      // The lower levels have no column of their own (the board is about the
      // third mark) but they are on every row, so the range filter is where
      // they earn their place rather than two more counts across the table.
      { key: "marks2", label: tGame("marks.2"), value: (r) => r.marks2 },
      { key: "marks1", label: tGame("marks.1"), value: (r) => r.marks1 },
      { key: "known", label: t("read"), value: (r) => r.known },
      { key: "battles", label: tView("battles"), value: (r) => r.battles },
    ],
    [t, tGame, tView, tiers],
  );
  const { filtered, filters } = useLeaderboardFilter(results, {
    searchFields,
    rangeCols,
    initialRangeCol: "marks3",
    syncUrl: true,
  });

  const { paged, pager } = usePagination(filtered, PAGINATION.SIZE.LEADERBOARD, {
    initialPage: page,
    crawlable: page !== undefined,
  });

  const fetchAll = (s: string) =>
    unicum
      .region(region)
      .players.marks({
        sort: s,
        limit: MAX_ROWS,
        ...(language ? { lang: language } : {}),
        ...(strict ? { strict: "true" as const } : {}),
      })
      .then((res) => res.results as unknown as MarksRow[]);

  // Reflect the ranking column in the URL with a plain `history.replaceState`
  // (no RSC round trip), keeping the default-sort address clean so a shared
  // link of the canonical view stays the canonical view.
  function syncUrl(s: string) {
    const params = new URLSearchParams(window.location.search);
    if (s !== DEFAULT_MARKS_SORT) params.set("sort", s);
    else params.delete("sort");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }

  async function changeSort(s: string) {
    if (s === sort) return;
    setSort(s);
    syncUrl(s);
    setLoading(true);
    try {
      setResults(await fetchAll(s));
    } finally {
      setLoading(false);
    }
  }

  // Adopt a `?sort=` deep link once on mount: the page is static, so the query
  // is only readable here.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const raw = new URLSearchParams(window.location.search).get("sort");
    if (raw && isMarksSort(raw) && raw !== DEFAULT_MARKS_SORT) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link is only readable client-side after mount (the page is static)
      void changeSort(raw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  if (results.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  // The top tiers stay on a phone and the rest wait for room. Counted from the
  // end of the list rather than against tier numbers, so this keeps meaning the
  // same thing when the game grows a tier.
  const tierCellClass = (index: number) =>
    index >= tiers.length - TIERS_ON_MOBILE ? "" : "hidden xl:table-cell";

  return (
    <>
      <div className="border-b border-fd-border px-4 py-2.5">
        <LeaderboardFilterBar
          filters={filters}
          searchNoun={FilterSubject.Players}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("no-match")}
        </div>
      ) : (
        <Table
          aria-busy={loading}
          className={cn(
            // Same compact model as the other player boards so this reads as a
            // sibling of them.
            "my-0! table-fixed transition-opacity",
            loading && "opacity-60",
            "[&_td]:min-w-0 [&_td]:py-2!",
            "[&_tbody_td:first-child]:pl-4!",
            "[&_thead_th:first-child]:pl-4!",
          )}
        >
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center!">#</TableHead>
              <TableHead>{tView("columns.player")}</TableHead>
              <TableHead className="hidden w-24 text-right! 2xl:table-cell">
                {tView("battles")}
              </TableHead>
              <TableHead className="hidden w-28 text-right! 2xl:table-cell">
                {t("read")}
              </TableHead>
              <RankingColumnHead
                sortKey={MARKS_SORT_TOTAL}
                active={sort === MARKS_SORT_TOTAL}
                onSort={changeSort}
                className="w-32"
              >
                {tGame("marks.3")}
              </RankingColumnHead>
              {tiers.map((tier, index) => (
                <RankingColumnHead
                  key={tier}
                  sortKey={marksSortForTier(tier)}
                  active={sort === marksSortForTier(tier)}
                  onSort={changeSort}
                  caretWhenIdle={false}
                  // Wide enough for the longest numeral AND the caret the
                  // active column grows: at `w-12` the ranked column truncated
                  // its own heading, so "VI" read as "V" on exactly the column
                  // the reader had just clicked.
                  className={cn("w-14", tierCellClass(index))}
                >
                  {toRoman(tier)}
                </RankingColumnHead>
              ))}
              {/* One heading per metric, hidden by the same rule as the cells
                  under it, so the column that shows always has its own name
                  above it. */}
              <TableHead data-rating-col="wn7" className="w-20 pr-4! text-right!">
                {tView("wn7")}
              </TableHead>
              <TableHead data-rating-col="wn8" className="w-20 pr-4! text-right!">
                {tView("wn8")}
              </TableHead>
              <TableHead data-rating-col="wnx" className="w-20 pr-4! text-right!">
                {tView("wnx")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((r, i) => {
              const rank = pager.firstShown + i;
              return (
                <TableRow key={r.account_id}>
                  <TableCell className="text-center text-muted-foreground tabular-nums">
                    {rank <= 3 ? (
                      <RankMedal rank={rank as 1 | 2 | 3} className="mx-auto" />
                    ) : (
                      rank
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <PlayerName
                        region={region}
                        player={identityFromRow(r)}
                        href={ROUTES.PLAYER(region, r.nickname)}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums 2xl:table-cell">
                    {num(INT_FORMAT).format(r.battles)}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums 2xl:table-cell">
                    {num(INT_FORMAT).format(r.known)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {num(INT_FORMAT).format(r.marks3)}
                  </TableCell>
                  {tiers.map((tier, index) => {
                    const count = markCountAtTier(r.marks3_by_tier, tier);
                    return (
                      <TableCell
                        key={tier}
                        className={cn(
                          "text-right tabular-nums",
                          tierCellClass(index),
                          count === 0 && "text-muted-foreground/40",
                        )}
                      >
                        {/* A zero is a dash rather than a "0": the column counts
                            an achievement, and a wall of zeroes across eleven
                            tiers reads as missing data instead of as none. */}
                        {count > 0 ? num(INT_FORMAT).format(count) : "—"}
                      </TableCell>
                    );
                  })}
                  <RatingCells row={r} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {pager.total > 0 && <TablePager pager={pager} />}
    </>
  );
}
