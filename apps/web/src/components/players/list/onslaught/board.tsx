"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { GlossaryLabel } from "@/components/glossary/label";
import { PlayerName } from "@/components/entity/player-name";
import { identityFromRow } from "@/components/entity/player-identity";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import {
  OnslaughtSeasonSelect,
  type OnslaughtSeasonRef,
} from "@/components/players/list/onslaught/season-select";
import { Chip, ChipRow } from "@/components/ui/chip";
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
  ONSLAUGHT_TIER_COLOR,
  ONSLAUGHT_TIER_LABEL,
  onslaughtRankIcon,
  onslaughtTier,
  OnslaughtTier,
  RATING_COLOR_CLASS,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const INITIAL_PAGE_SIZE = 100;

// The board is the game's own rank order by default; the columns re-sort the
// fully-loaded set client-side (no re-fetch, since we hold every row).
type SortCol = "battles" | "rating";
type SortState = { col: SortCol; dir: "asc" | "desc" };
const TIERS = [OnslaughtTier.Legend, OnslaughtTier.Champion] as const;

// A client-side sortable column header: a first click sorts that metric
// descending (biggest first), a second click flips the direction.
function SortHead({
  col,
  sort,
  setSort,
  className,
  children,
}: {
  col: SortCol;
  sort: SortState;
  setSort: (s: SortState) => void;
  className?: string;
  children: ReactNode;
}) {
  const active = sort.col === col;
  const Icon = active
    ? sort.dir === "asc"
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() =>
        setSort(
          active
            ? { col, dir: sort.dir === "asc" ? "desc" : "asc" }
            : { col, dir: "desc" },
        )
      }
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 font-medium whitespace-nowrap select-none hover:text-foreground",
        active ? "text-foreground" : "",
      )}
    >
      {children}
      <Icon
        weight="bold"
        className={cn("size-3.5", active ? "opacity-100" : "opacity-40")}
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

// One Onslaught board row. Shape matches the `/players/onslaught` response
// (OnslaughtSummary): the standings straight from the game source.
export type OnslaughtRow = {
  rank: number;
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  recordedNickname: string;
  recordedClanTag: string | null;
  recordedClanColor: string | null;
  rating: number;
  battles: number;
  is_verified: boolean;
  is_supporter: boolean;
  twitch_login: string | null;
  tournament_wins: number;
  tournament_featured_wins: number;
  tournament_best_title: string | null;
};

export function OnslaughtBoard({
  region,
  results,
  elitePosition,
  masterPosition,
  seasonOrdinal,
  assetsRef,
  seasons,
  currentSeasonId,
}: {
  region: Region;
  results: OnslaughtRow[];
  elitePosition: number | null;
  masterPosition: number | null;
  seasonOrdinal: string | null;
  assetsRef: string | null;
  seasons: OnslaughtSeasonRef[];
  currentSeasonId: string | null;
}) {
  // Filter over the fully-loaded standings: search matches the current AND
  // recorded nickname/clan (findable by who they are now or the name they held
  // when ranked), plus a min/max range on Battles or Rating Points.
  const searchFields = useCallback(
    (r: OnslaughtRow) => [
      r.nickname,
      r.recordedNickname,
      r.clan_tag,
      r.recordedClanTag,
    ],
    [],
  );
  const rangeCols = useMemo<RangeColumn<OnslaughtRow>[]>(
    () => [
      { key: "rating", label: "Rating Points", value: (r) => r.rating },
      { key: "battles", label: "Battles", value: (r) => r.battles },
    ],
    [],
  );
  const { filtered, filters } = useLeaderboardFilter(results, {
    searchFields,
    rangeCols,
    initialRangeCol: "rating",
    syncUrl: true,
  });

  // Rating Points descending is the game's own order (its ranks derive from it).
  const [sort, setSort] = useState<SortState>({ col: "rating", dir: "desc" });
  const [tierSel, setTierSel] = useState<Set<OnslaughtTier>>(() => new Set());
  const toggleTier = (t: OnslaughtTier) =>
    setTierSel((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  // Mirror the sort + rank filter to `?sort=&dir=&rank=` (shareable, survives
  // reload), seeding from the URL once on mount then writing back on change.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("sort");
    if (s === "battles" || s === "rating") {
      setSort({ col: s, dir: p.get("dir") === "asc" ? "asc" : "desc" });
    }
    const ranks = (p.get("rank") ?? "")
      .split(",")
      .filter(
        (r): r is OnslaughtTier =>
          r === OnslaughtTier.Legend || r === OnslaughtTier.Champion,
      );
    if (ranks.length) setTierSel(new Set(ranks));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const skipSortWrite = useRef(true);
  useEffect(() => {
    if (skipSortWrite.current) {
      skipSortWrite.current = false;
      return;
    }
    const p = new URLSearchParams(window.location.search);
    const setOrDel = (k: string, v: string) => {
      if (v) p.set(k, v);
      else p.delete(k);
    };
    const defaultSort = sort.col === "rating" && sort.dir === "desc";
    setOrDel("sort", defaultSort ? "" : sort.col);
    setOrDel("dir", defaultSort ? "" : sort.dir);
    setOrDel("rank", [...tierSel].join(","));
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [sort, tierSel]);

  // Rank-tier filter + client-side sort over the searched/ranged set.
  const processed = useMemo(() => {
    let rows = filtered;
    if (tierSel.size > 0)
      rows = rows.filter((r) => {
        const t = onslaughtTier(r.rank, { elitePosition, masterPosition });
        return t != null && tierSel.has(t);
      });
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (r: OnslaughtRow) =>
      sort.col === "battles" ? r.battles : r.rating;
    return [...rows].sort((a, b) => (val(a) - val(b)) * dir);
  }, [filtered, tierSel, sort, elitePosition, masterPosition]);

  const { paged, pager } = usePagination(processed, INITIAL_PAGE_SIZE);

  // How many ranked players fall in each rank, for the chip labels.
  const tierCounts = useMemo(() => {
    const counts: Record<OnslaughtTier, number> = {
      [OnslaughtTier.Legend]: 0,
      [OnslaughtTier.Champion]: 0,
    };
    for (const r of results) {
      const t = onslaughtTier(r.rank, { elitePosition, masterPosition });
      if (t) counts[t] += 1;
    }
    return counts;
  }, [results, elitePosition, masterPosition]);

  const rankChips = (
    <ChipRow className="h-7">
      {TIERS.map((t) => (
        <Chip
          key={t}
          active={tierSel.has(t)}
          onClick={() => toggleTier(t)}
          className="flex h-full items-center py-0"
        >
          <span className="inline-flex items-center gap-1.5">
            <Image
              src={onslaughtRankIcon(t, seasonOrdinal, assetsRef)}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4"
            />
            {ONSLAUGHT_TIER_LABEL[t]}
            <span className="text-fd-muted-foreground/70 tabular-nums">
              ({intFmt.format(tierCounts[t])})
            </span>
          </span>
        </Chip>
      ))}
    </ChipRow>
  );

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>Top {results.length} Onslaught players</PanelTitle>
        <OnslaughtSeasonSelect
          seasons={seasons}
          current={currentSeasonId}
          region={region}
        />
      </PanelHeader>
      <PanelContent className="p-0">
        {results.length > 0 && (
          <div className="border-b border-fd-border px-4 py-2.5">
            <LeaderboardFilterBar
              filters={filters}
              searchNoun="players"
              extra={rankChips}
            />
          </div>
        )}
        {results.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No Onslaught standings yet.
          </div>
        ) : processed.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No player matches the current filters.
          </div>
        ) : (
          <Table
            className={cn(
              "my-0! table-fixed",
              "[&_td]:min-w-0 [&_td]:py-2!",
              "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
              "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
            )}
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center!">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="hidden w-28 text-right! sm:table-cell">
                  {/* The mode's own ladder, not a leaderboard position: the
                      row's number is in the first column. */}
                  <GlossaryLabel label="Onslaught">Rank</GlossaryLabel>
                </TableHead>
                <SortHead
                  col="battles"
                  sort={sort}
                  setSort={setSort}
                  className="w-24"
                >
                  Battles
                </SortHead>
                <SortHead
                  col="rating"
                  sort={sort}
                  setSort={setSort}
                  className="w-32"
                >
                  Rating Points
                </SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => {
                const tier = onslaughtTier(r.rank, {
                  elitePosition,
                  masterPosition,
                });
                const colorClass = tier
                  ? RATING_COLOR_CLASS[ONSLAUGHT_TIER_COLOR[tier]]
                  : "";
                return (
                  <TableRow key={r.account_id}>
                    <TableCell className="text-center text-muted-foreground tabular-nums">
                      {r.rank <= 3 ? (
                        <RankMedal
                          rank={r.rank as 1 | 2 | 3}
                          className="mx-auto"
                        />
                      ) : (
                        r.rank
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2">
                        <PlayerName
                          region={region}
                          player={identityFromRow(r)}
                          href={ROUTES.PLAYER_ONSLAUGHT(region, r.nickname)}
                        />
                        {r.recordedNickname !== r.nickname ||
                        r.recordedClanTag !== r.clan_tag ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            (as {r.recordedNickname}
                            {r.recordedClanTag ? ` [${r.recordedClanTag}]` : ""})
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {tier ? (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <Image
                            src={onslaughtRankIcon(tier, seasonOrdinal, assetsRef)}
                            alt=""
                            width={22}
                            height={22}
                            className="h-5 w-5 shrink-0"
                          />
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-xs font-semibold",
                              colorClass,
                            )}
                          >
                            {ONSLAUGHT_TIER_LABEL[tier]}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {intFmt.format(r.battles)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        colorClass,
                      )}
                    >
                      {intFmt.format(r.rating)}
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
