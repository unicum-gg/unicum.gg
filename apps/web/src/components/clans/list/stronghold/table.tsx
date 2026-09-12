"use client";

import { useFormat } from "@/hooks/use-format";
import { CaretDownIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { ClanName } from "@/components/entity/clan-name";
import { clanIdentityFromRow } from "@/components/entity/clan-identity";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
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
import { useTranslation } from "@/hooks/use-translation";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const PCT_FORMAT = {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

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
  children,
}: {
  sortKey: StrongholdSort;
  active: boolean;
  onSort: (s: StrongholdSort) => void;
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
  const { num } = useFormat();
  const { t } = useTranslation("components/clans/list/stronghold/table");
  const { t: tCol } = useTranslation("components/columns");
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
            <TableHead>{tCol("clan")}</TableHead>
            <TableHead className="w-24 text-center!">{tCol("members")}</TableHead>
            <SortableHead
              sortKey={StrongholdSort.Elo}
              active={sort === StrongholdSort.Elo}
              onSort={onSort}
              className="w-24"
            >
              {t("elo")}</SortableHead>
            <SortableHead
              sortKey={StrongholdSort.Battles}
              active={sort === StrongholdSort.Battles}
              onSort={onSort}
              className="w-24"
            >
              {t("battles")}</SortableHead>
            <SortableHead
              sortKey={StrongholdSort.Winrate}
              active={sort === StrongholdSort.Winrate}
              onSort={onSort}
              className="w-28"
            >
              {t("wr")}</SortableHead>
            <SortableHead
              sortKey={StrongholdSort.Rating}
              active={sort === StrongholdSort.Rating}
              onSort={onSort}
              className="w-24"
            >
              {t("sr")}</SortableHead>
            <SortableHead
              sortKey={StrongholdSort.RatingBattles}
              active={sort === StrongholdSort.RatingBattles}
              onSort={onSort}
              className="w-24"
            >
              {t("srb")}</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="px-4 py-12 text-center text-sm text-muted-foreground"
              >
                {t("no-clan-matches-the-current")}</TableCell>
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
                  <ClanName
                    region={region}
                    clan={clanIdentityFromRow(entry)}
                    href={ROUTES.CLAN_STRONGHOLD(region, entry.tag, tier)}
                    showEmblem
                    showName
                    // The board this table IS, so a row does not repeat its own
                    // placing on every line.
                    omitBoard={CLAN_BOARD_BY_STRONGHOLD_TIER[tier]}
                    size={14}
                    trailing={
                      <>
                        <RosterBoostBadge boostRatio={entry.boostRatio} />
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
                      </>
                    }
                  />
                </TableCell>
                <TableCell className="text-center text-muted-foreground tabular-nums">
                  {num(INT_FORMAT).format(entry.membersCount)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {entry.elo !== null ? num(INT_FORMAT).format(entry.elo) : "—"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {num(INT_FORMAT).format(entry.battles)}
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
                  {winrate !== null ? num(PCT_FORMAT).format(winrate) : "—"}
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
                  {entry.sr !== null ? num(INT_FORMAT).format(entry.sr) : "—"}
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
                  {entry.srb !== null ? num(INT_FORMAT).format(entry.srb) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
