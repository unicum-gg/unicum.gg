"use client";

import { CaretDownIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageFlags } from "@/components/language-flags";
import { RankMedal } from "@/components/rank-medal";
import { StrongholdTierTabs } from "@/components/clans/stronghold-tier-tabs";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  StrongholdSort,
  StrongholdTier,
  STRONGHOLD_MIN_BATTLES,
  STRONGHOLD_SORT_LABEL,
  STRONGHOLD_TIER_LABEL,
} from "@/constants/stronghold";
import type { StrongholdLeaderboardEntry } from "@/services/clans/stronghold-leaderboard";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming/region";
import { REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming/region";
import {
  RATING_COLOR_CLASS,
  strongholdWinrateColor,
} from "@/services/wargaming/wot/ratings";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// The leaderboard is ranked server-side, always descending (best first), so a
// header click just re-navigates with the new `sort` param. The caret marks the
// active column rather than toggling asc/desc.
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

export function StrongholdLeaderboardView({
  region,
  tier,
  sort,
  results,
}: {
  region: Region;
  tier: StrongholdTier;
  sort: StrongholdSort;
  results: StrongholdLeaderboardEntry[];
}) {
  const router = useRouter();

  function setSort(s: StrongholdSort) {
    router.push(`${ROUTES.STRONGHOLD(region, tier)}?sort=${s}`, {
      scroll: false,
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <p className="mb-2 text-sm text-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </p>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Top{" "}
            <span className="text-[#f25322]">
              {STRONGHOLD_TIER_LABEL[tier]}
            </span>{" "}
            clans
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {REGION_LABEL[region]} leaderboard, ranked by{" "}
            {STRONGHOLD_SORT_LABEL[sort]} across all tracked clans
            {tier === StrongholdTier.Advances
              ? " in Advances (15v15)"
              : ` in ${STRONGHOLD_TIER_LABEL[tier]} (7v7)`}{" "}
            (minimum {STRONGHOLD_MIN_BATTLES[tier]} battles).
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <StrongholdTierTabs region={region} activeTier={tier} />

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>
            Top {results.length} {STRONGHOLD_TIER_LABEL[tier]} clans
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No data yet — check back once clans have been refreshed.
            </p>
          ) : (
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
                      onSort={setSort}
                      className="w-24"
                    >
                      ELO
                    </SortableHead>
                    <SortableHead
                      sortKey={StrongholdSort.Battles}
                      active={sort === StrongholdSort.Battles}
                      onSort={setSort}
                      className="w-24"
                    >
                      Battles
                    </SortableHead>
                    <SortableHead
                      sortKey={StrongholdSort.Battles30d}
                      active={sort === StrongholdSort.Battles30d}
                      onSort={setSort}
                      className="w-32"
                    >
                      30d battles
                    </SortableHead>
                    <SortableHead
                      sortKey={StrongholdSort.Winrate}
                      active={sort === StrongholdSort.Winrate}
                      onSort={setSort}
                      className="w-28"
                      tooltip="Win rate"
                    >
                      WR
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((entry, i) => {
                    const winrate =
                      entry.battles > 0 ? entry.wins / entry.battles : null;
                    return (
                      <TableRow key={entry.clanId}>
                        <TableCell className="text-center text-muted-foreground tabular-nums">
                          {i < 3 ? (
                            <RankMedal
                              rank={(i + 1) as 1 | 2 | 3}
                              className="mx-auto"
                            />
                          ) : (
                            i + 1
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={ROUTES.CLAN(region, entry.tag)}
                            prefetch={false}
                            className="flex items-center gap-3 hover:underline"
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
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="min-w-0 flex-1 truncate">
                                <span className="font-mono font-semibold">
                                  <span style={{ color: entry.color }}>[</span>
                                  {entry.tag}
                                  <span style={{ color: entry.color }}>]</span>
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {entry.name}
                                </span>
                              </span>
                              {entry.languages.length > 0 && (
                                <span className="hidden h-4 shrink-0 sm:inline-flex">
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
                          </Link>
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
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {entry.battles30d !== null
                            ? `+${intFmt.format(entry.battles30d)}`
                            : "—"}
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
