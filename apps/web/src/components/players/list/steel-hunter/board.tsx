"use client";

import { useFormat } from "@/hooks/use-format";
import { CaretDownIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { PlayerName } from "@/components/entity/player-name";
import { identityFromRow } from "@/components/entity/player-identity";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { RankMedal } from "@/components/rank-medal";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
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
import {
  DEFAULT_STEEL_HUNTER_SORT,
  hrbColor,
  hrColor,
  isSteelHunterSort,
  RATING_COLOR_CLASS,
  steelHunterWinrateColor,
  SteelHunterSort,
} from "@unicum.gg/shared";
import { unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";
import { FilterSubject } from "@/components/filter-subject";
import { useTranslation } from "@/hooks/use-translation";
import { battleTypeName } from "@/components/game-name";
import { BattleType } from "@unicum.gg/shared";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// Mirror the API contract (PLAYERS_TOP_MAX_LIMIT): pull the whole ranking (up
// to 1000) and paginate client-side. Kept local so this client component does
// not pull the server-side schemas module into the browser bundle.
const MAX_ROWS = 1000;
const INITIAL_PAGE_SIZE = 100;

// One Steel Hunter board row. Shape matches the `/players/steel-hunter`
// response (SteelHunterSummary): the raw SH totals, from which the display
// derives win rate / survival / avg damage.
export type SteelHunterRow = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  hr: number;
  hrb: number;
  battles: number;
  wins: number;
  survived: number;
  damage: number;
  frags: number;
  is_verified: boolean;
  is_supporter: boolean;
  twitch_login: string | null;
  tournament_wins: number;
  tournament_featured_wins: number;
  tournament_best_title: string | null;
};

// The board is ranked server-side, always descending (best first), so a header
// click re-fetches that column's true top-N (a different set of players, not a
// reorder). The caret marks the active column rather than toggling asc/desc.
// Mirrors the stronghold board's SortableHead.
function SortableHead({
  sortKey,
  active,
  onSort,
  className,
  children,
}: {
  sortKey: SteelHunterSort;
  active: boolean;
  onSort: (s: SteelHunterSort) => void;
  className?: string;
  children: ReactNode;
}) {
  const Icon = active ? CaretDownIcon : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 max-w-full min-w-0 font-medium select-none hover:text-foreground",
        active ? "text-foreground" : "",
      )}
    >
      {/* `data-head-label` is what the tooltip measures: it shows the full
            heading only when the column really cut it. */}
      <span data-head-label className="truncate">
        {children}
      </span>
      <Icon
        weight="bold"
        className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
  return (
    <TableHead className={cn("text-right!", className)}>
      <GlossaryHeadTooltip
        label={typeof children === "string" ? children : undefined}
      >
        {button}
      </GlossaryHeadTooltip>
    </TableHead>
  );
}

export function SteelHunterBoard({
  region,
  initialResults,
}: {
  region: Region;
  initialResults: SteelHunterRow[];
}) {

  const { num } = useFormat();
  const { t } = useTranslation("components/players/list/steel-hunter/view");
  const { t: tOwn } = useTranslation("components/players/list/steel-hunter/board");
  const { t: tGame } = useTranslation("game/vocabulary");
  const mode = battleTypeName(BattleType.BattleRoyale, tGame);
  // The page is prerendered (ISR) at the canonical view (HR sort), seeded here
  // with the full ranking as `initialResults`, then paginated client-side. A
  // column click re-ranks the WHOLE board, so it re-fetches the full ranking in
  // that order through the SDK (a different set of players, not a reorder of the
  // loaded page); pagination resets to page 1 on the new list.
  const [sort, setSort] = useState<SteelHunterSort>(DEFAULT_STEEL_HUNTER_SORT);
  const [results, setResults] = useState(initialResults);
  const [loading, setLoading] = useState(false);

  // Client-side filter over the loaded ranking (search by name/clan + a min/max
  // range on any metric). It narrows the current top-N, it does not re-rank.
  const searchFields = useCallback(
    (r: SteelHunterRow) => [r.nickname, r.clan_tag],
    [],
  );
  const rangeCols = useMemo<RangeColumn<SteelHunterRow>[]>(
    () => [
      { key: "hr", label: "HR", value: (r) => r.hr },
      { key: "hrb", label: "HRB", value: (r) => r.hrb },
      { key: "battles", label: t("columns.battles"), value: (r) => r.battles },
      {
        key: "winrate",
        label: "WR %",
        value: (r) => (r.battles > 0 ? (r.wins / r.battles) * 100 : null),
      },
      {
        key: "survival",
        label: t("columns.survival-percent"),
        value: (r) => (r.battles > 0 ? (r.survived / r.battles) * 100 : null),
      },
      {
        key: "damage",
        label: t("columns.damage"),
        value: (r) => (r.battles > 0 ? r.damage / r.battles : null),
      },
    ],
    [t],
  );
  const { filtered, filters } = useLeaderboardFilter(results, {
    searchFields,
    rangeCols,
    initialRangeCol: "hr",
    syncUrl: true,
  });

  const { paged, pager } = usePagination(filtered, INITIAL_PAGE_SIZE);

  const fetchAll = (s: SteelHunterSort) =>
    unicum
      .region(region)
      .players.steelHunter({ sort: s, limit: MAX_ROWS })
      .then((res) => res.results as unknown as SteelHunterRow[]);

  // Reflect the sort in the URL without a Next navigation (plain
  // `history.replaceState`, no RSC round-trip), keeping the default-sort URL
  // clean and preserving shareable deep links.
  function syncUrl(s: SteelHunterSort) {
    const params = new URLSearchParams(window.location.search);
    if (s !== DEFAULT_STEEL_HUNTER_SORT) params.set("sort", s);
    else params.delete("sort");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }

  async function changeSort(s: SteelHunterSort) {
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

  // Adopt a `?sort=` deep link once on mount (window.location is only readable
  // client-side; the page itself is static). Fetches that sort's full ranking.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const raw = new URLSearchParams(window.location.search).get("sort");
    if (raw && isSteelHunterSort(raw) && raw !== DEFAULT_STEEL_HUNTER_SORT) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link is only readable client-side after mount (the page is static)
      void changeSort(raw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          {t("board", { count: results.length, mode })}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        {results.length > 0 && (
          <div className="border-b border-fd-border px-4 py-2.5">
            <LeaderboardFilterBar filters={filters} searchNoun={FilterSubject.Players} />
          </div>
        )}
        {results.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {tOwn("no-ranked-steel-hunter-players")}</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {tOwn("no-player-matches-the-current")}</div>
        ) : (
          <Table
            aria-busy={loading}
            className={cn(
              // Same compact model as the WNX board so this reads as a sibling.
              "my-0! table-fixed transition-opacity",
              loading && "opacity-60",
              "[&_td]:min-w-0 [&_td]:py-2!",
              "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
              "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
            )}
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center!">#</TableHead>
                <TableHead>{t("columns.player")}</TableHead>
                <SortableHead
                  sortKey={SteelHunterSort.Battles}
                  active={sort === SteelHunterSort.Battles}
                  onSort={changeSort}
                  className="w-24"
                >
                  {t("columns.battles")}
                </SortableHead>
                <SortableHead
                  sortKey={SteelHunterSort.Survival}
                  active={sort === SteelHunterSort.Survival}
                  onSort={changeSort}
                  className="hidden w-24 md:table-cell"
                >
                  {t("columns.survival")}
                </SortableHead>
                <SortableHead
                  sortKey={SteelHunterSort.Damage}
                  active={sort === SteelHunterSort.Damage}
                  onSort={changeSort}
                  className="hidden w-28 md:table-cell"
                >
                  {t("columns.damage")}
                </SortableHead>
                <SortableHead
                  sortKey={SteelHunterSort.Winrate}
                  active={sort === SteelHunterSort.Winrate}
                  onSort={changeSort}
                  className="hidden w-24 sm:table-cell"
                >
                  {tOwn("wr")}</SortableHead>
                <SortableHead
                  sortKey={SteelHunterSort.Hr}
                  active={sort === SteelHunterSort.Hr}
                  onSort={changeSort}
                  className="w-24"
                >
                  {tOwn("hr")}</SortableHead>
                <SortableHead
                  sortKey={SteelHunterSort.Hrb}
                  active={sort === SteelHunterSort.Hrb}
                  onSort={changeSort}
                  className="w-24"
                >
                  {tOwn("hrb")}</SortableHead>
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
                          href={ROUTES.PLAYER_STEEL_HUNTER(region, r.nickname)}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {num(INT_FORMAT).format(r.battles)}
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                      {r.battles > 0 ? pct(r.survived / r.battles) : "—"}
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                      {r.battles > 0 ? num(INT_FORMAT).format(r.damage / r.battles) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden text-right font-semibold tabular-nums sm:table-cell",
                        r.battles > 0 &&
                          RATING_COLOR_CLASS[
                            steelHunterWinrateColor(r.wins / r.battles)
                          ],
                      )}
                    >
                      {r.battles > 0 ? pct(r.wins / r.battles) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        RATING_COLOR_CLASS[hrColor(r.hr)],
                      )}
                    >
                      {num(INT_FORMAT).format(r.hr)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        RATING_COLOR_CLASS[hrbColor(r.hrb)],
                      )}
                    >
                      {num(INT_FORMAT).format(r.hrb)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {pager.total > 0 && <TablePager pager={pager} />}
      </PanelContent>
    </Panel>
  );
}
