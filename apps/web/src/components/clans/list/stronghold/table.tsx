"use client";

import { CaretDownIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClanBadges } from "@/components/entity/badges/clan-rank-badge";
import { ClanTag } from "@/components/entity/clan-tag";
import { RosterBoostBadge } from "@/components/clans/roster-boost-badge";
import { LanguageFlags } from "@/components/language-flags";
import { RankMedal } from "@/components/rank-medal";
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
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import {
  CLAN_BOARD_BY_STRONGHOLD_TIER,
  RATING_COLOR_CLASS,
  StrongholdSort,
  type StrongholdTier,
  strongholdRatingBattlesColor,
  strongholdRatingColor,
  strongholdWinrateColor,
} from "@unicum.gg/shared";
import type { StrongholdLeaderboardEntry } from "@/services/clans/stronghold-leaderboard";
import type { Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * A board entry carrying the rank it holds in the server ranking, so the #
 * column keeps the clan's true standing once the filter bar narrows the rows.
 */
export type RankedStrongholdEntry = StrongholdLeaderboardEntry & {
  rank: number;
};

// The leaderboard is ranked server-side, always descending (best first), so a
// header click just re-fetches that sort's top 100 (a different set of clans,
// not a reorder). The caret marks the active column rather than toggling
// asc/desc.
function SortableHead({
  sortKey,
  active,
  onSort,
  className,
  tooltip,
  children,
}: {
  sortKey: StrongholdSort;
  active: boolean;
  onSort: (s: StrongholdSort) => void;
  className?: string;
  tooltip?: string;
  children: ReactNode;
}) {
  const Icon = active ? CaretDownIcon : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
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
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </TableHead>
  );
}

/** The stronghold leaderboard table itself: sortable headers plus one row per
 * clan. `rows` is already searched/ranged by the caller's filter bar, and the
 * empty state lives inside the body on purpose: a filter that matches nothing
 * would otherwise take the sort headers with it, leaving no way back to another
 * sort (each one is a different top 100, so the match set changes with it). */
export function StrongholdTable({
  region,
  tier,
  sort,
  onSort,
  rows,
}: {
  region: Region;
  tier: StrongholdTier;
  sort: StrongholdSort;
  onSort: (s: StrongholdSort) => void;
  rows: RankedStrongholdEntry[];
}) {
  return (
    <TooltipProvider delayDuration={150}>
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
            <TableHead className="w-12 text-center!">#</TableHead>
            <TableHead>Clan</TableHead>
            <TableHead className="w-24 text-center!">Members</TableHead>
            <SortableHead
              sortKey={StrongholdSort.Elo}
              active={sort === StrongholdSort.Elo}
              onSort={onSort}
              className="w-24"
            >
              ELO
            </SortableHead>
            <SortableHead
              sortKey={StrongholdSort.Battles}
              active={sort === StrongholdSort.Battles}
              onSort={onSort}
              className="w-24"
            >
              Battles
            </SortableHead>
            <SortableHead
              sortKey={StrongholdSort.Winrate}
              active={sort === StrongholdSort.Winrate}
              onSort={onSort}
              className="w-28"
              tooltip="Win rate"
            >
              WR
            </SortableHead>
            <SortableHead
              sortKey={StrongholdSort.Rating}
              active={sort === StrongholdSort.Rating}
              onSort={onSort}
              className="w-24"
              tooltip="Skirmish Rating. Win rate and battle volume weighted by the roster's average WG Personal Rating (rewards winning with a strong roster, discounts farming with weak accounts)."
            >
              SR
            </SortableHead>
            <SortableHead
              sortKey={StrongholdSort.RatingBattles}
              active={sort === StrongholdSort.RatingBattles}
              onSort={onSort}
              className="w-24"
              tooltip="Battles-based Stronghold Rating: the same SR with battle volume rewarded instead of only gated, so clans that have proven it over many battles rank higher."
            >
              SRB
            </SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="px-4 py-12 text-center text-sm text-muted-foreground"
              >
                No clan matches the current filters.
              </TableCell>
            </TableRow>
          )}
          {rows.map((entry) => {
            const winrate =
              entry.battles > 0 ? entry.wins / entry.battles : null;
            return (
              <TableRow key={entry.clanId}>
                <TableCell className="text-center text-muted-foreground tabular-nums">
                  {entry.rank <= 3 ? (
                    <RankMedal
                      rank={entry.rank as 1 | 2 | 3}
                      className="mx-auto"
                    />
                  ) : (
                    entry.rank
                  )}
                </TableCell>
                <TableCell>
                  {/* Badges are siblings of the row link (each crest
                      links to its own board) and the link does not take
                      `flex-1`, so they stay next to the name instead of
                      drifting to the edge of the cell. */}
                  <span className="flex items-center gap-2">
                  <Link
                    href={ROUTES.CLAN_STRONGHOLD(region, entry.tag, tier)}
                    className="flex min-w-0 items-center gap-3 hover:underline"
                  >
                    {entry.emblem ? (
                      <Image
                        src={entry.emblem}
                        alt=""
                        width={24}
                        height={24}
                        className="size-6 shrink-0 rounded"
                      />
                    ) : (
                      <span className="size-6 shrink-0 rounded bg-muted" />
                    )}
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate">
                        <ClanTag
                          tag={entry.tag}
                          color={entry.color}
                          className="font-mono font-semibold"
                        />{" "}
                        <span className="text-muted-foreground">
                          {entry.name}
                        </span>
                      </span>
                      <RosterBoostBadge boostRatio={entry.boostRatio} />
                    </span>
                  </Link>
                  <ClanBadges
                    badges={entry.badges?.filter(
                      (b) => b.board !== CLAN_BOARD_BY_STRONGHOLD_TIER[tier],
                    )}
                    region={region}
                    size={14}
                  />
                  {entry.languages.length > 0 && (
                    <span className="ml-auto hidden h-4 shrink-0 sm:inline-flex">
                      <LanguageFlags
                        languages={entry.languages}
                        source="declared"
                        size="s"
                        region={region}
                        link={false}
                      />
                    </span>
                  )}
                  </span>
                </TableCell>
                <TableCell className="text-center text-muted-foreground tabular-nums">
                  {intFmt.format(entry.membersCount)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {entry.elo !== null ? intFmt.format(entry.elo) : "—"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {intFmt.format(entry.battles)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    winrate !== null &&
                      RATING_COLOR_CLASS[
                        strongholdWinrateColor(winrate)
                      ],
                  )}
                >
                  {winrate !== null ? pctFmt.format(winrate) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-bold tabular-nums",
                    entry.sr !== null &&
                      RATING_COLOR_CLASS[
                        strongholdRatingColor(entry.sr)
                      ],
                  )}
                >
                  {entry.sr !== null ? intFmt.format(entry.sr) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-bold tabular-nums",
                    entry.srb !== null &&
                      RATING_COLOR_CLASS[
                        strongholdRatingBattlesColor(entry.srb)
                      ],
                  )}
                >
                  {entry.srb !== null ? intFmt.format(entry.srb) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
