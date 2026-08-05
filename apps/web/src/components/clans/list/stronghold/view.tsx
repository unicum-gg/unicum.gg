"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { ClanTag } from "@/components/entity/clan-tag";
import { type ReactNode, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { LanguageFlags } from "@/components/language-flags";
import { RankMedal } from "@/components/rank-medal";
import { StrongholdTierTabs } from "@/components/clans/list/stronghold/tier-tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { StrongholdPeriod, StrongholdSort, StrongholdTier, STRONGHOLD_MIN_BATTLES, STRONGHOLD_PERIOD_LABEL, STRONGHOLD_SORT_LABEL, STRONGHOLD_TIER_LABEL, TIER_SORT_OPTIONS, RATING_COLOR_CLASS, strongholdWinrateColor } from "@unicum.gg/shared";
import type { StrongholdLeaderboardEntry } from "@/services/clans/stronghold-leaderboard";
import { unicum } from "@/services/sdk";
import { type Period, usePeriod, isPeriod } from "@/hooks/use-period";
import ROUTES from "@/constants/routes";
import { type Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// Only flag rosters where boost accounts are a real share, not the handful
// every clan carries.
const BOOST_BADGE_MIN = 0.15;

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

export function StrongholdLeaderboardView({
  region,
  tier,
  initialResults,
}: {
  region: Region;
  tier: StrongholdTier;
  initialResults: StrongholdLeaderboardEntry[];
}) {
  // Sort is per-tier local state (not shared); period IS the shared
  // `unicum.period` cookie (same one the home leaderboards use), so picking it
  // here carries back to them and vice versa. `Period` and `StrongholdPeriod`
  // are distinct enums with identical values, so the casts are runtime no-ops.
  const [sort, setSortState] = useState<StrongholdSort>(StrongholdSort.Rating);
  const [periodCookie, setPeriodCookie] = usePeriod();
  const period = periodCookie as unknown as StrongholdPeriod;

  // The page is prerendered (ISR) at the canonical view (SR + Overall), seeded
  // here as `initialResults`. Sort/period are then swapped client-side by
  // re-fetching that variant's top 100 through the SDK — no route navigation, so
  // switching stays a single cheap hit onto the materialized endpoint. The
  // cookie hydrating to `30d` after mount flips the key and refetches on its own.
  const { data } = useSWR(
    ["stronghold-top", region, tier, sort, period] as const,
    ([, r, t, s, p]) =>
      unicum
        .region(r)
        .clans.strongholdTop({ tier: t, sort: s, period: p })
        .then((res) => res.results as unknown as StrongholdLeaderboardEntry[]),
    {
      fallbackData: initialResults,
      revalidateOnMount: false,
      keepPreviousData: true,
    },
  );
  const results = data ?? initialResults;

  // Reflect sort/period in the URL without a Next navigation (a plain
  // `history.replaceState`, so no RSC round-trip), keeping the Overall/SR URL
  // clean. This preserves shareable deep links, which the mount effect re-reads.
  function syncUrl(nextSort: StrongholdSort, nextPeriod: StrongholdPeriod) {
    const params = new URLSearchParams();
    if (nextSort !== StrongholdSort.Rating) params.set("sort", nextSort);
    if (nextPeriod !== StrongholdPeriod.Overall)
      params.set("period", nextPeriod);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }

  function setSort(s: StrongholdSort) {
    setSortState(s);
    syncUrl(s, period);
  }

  function setPeriod(p: StrongholdPeriod) {
    setPeriodCookie(p as unknown as Period);
    syncUrl(sort, p);
  }

  // Adopt a `?sort=`/`?period=` deep link once on mount (window.location is only
  // client-side; a shared `?period=` also becomes the saved preference).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const sp = new URLSearchParams(window.location.search);
    const rawSort = sp.get("sort");
    const nextSort = TIER_SORT_OPTIONS[tier].find((s) => s === rawSort);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link is only readable client-side after mount (the page is static)
    if (nextSort) setSortState(nextSort);
    const rawPeriod = sp.get("period");
    if (rawPeriod && isPeriod(rawPeriod)) setPeriodCookie(rawPeriod);
  }, [tier, setPeriodCookie]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <p className="mb-2 text-sm text-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </p>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Top{" "}
            <span className="text-brand">
              {STRONGHOLD_TIER_LABEL[tier]}
            </span>{" "}
            clans
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {REGION_LABEL[region]} leaderboard, ranked by{" "}
            {STRONGHOLD_SORT_LABEL[sort]} across all tracked clans
            {tier === StrongholdTier.Advances
              ? " in Advances (15v15)"
              : ` in ${STRONGHOLD_TIER_LABEL[tier]} (7v7)`}
            {period === StrongholdPeriod.Month
              ? " over the past 30 days"
              : ""}{" "}
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
            Top {results.length} {STRONGHOLD_TIER_LABEL[tier]} clans ·{" "}
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as StrongholdPeriod)}
            >
              <SelectTrigger
                size="sm"
                aria-label="Period"
                className="-my-1 inline-flex! h-7! gap-1 px-1.5! py-0! align-middle text-xl! font-semibold [&_svg]:size-4"
              >
                <SelectValue>{STRONGHOLD_PERIOD_LABEL[period]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.values(StrongholdPeriod).map((per) => (
                  <SelectItem key={per} value={per}>
                    {STRONGHOLD_PERIOD_LABEL[per]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No data yet. Check back once clans have been refreshed.
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
                      sortKey={StrongholdSort.Rating}
                      active={sort === StrongholdSort.Rating}
                      onSort={setSort}
                      className="w-24"
                      tooltip="Skirmish Rating. Win rate and battle volume weighted by the roster's average WG Personal Rating (rewards winning with a strong roster, discounts farming with weak accounts)."
                    >
                      SR
                    </SortableHead>
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
                                <ClanTag
                                  tag={entry.tag}
                                  color={entry.color}
                                  className="font-mono font-semibold"
                                />{" "}
                                <span className="text-muted-foreground">
                                  {entry.name}
                                </span>
                              </span>
                              {entry.boostRatio !== null &&
                                entry.boostRatio >= BOOST_BADGE_MIN && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-500">
                                        <WarningIcon
                                          weight="fill"
                                          className="size-3"
                                        />
                                        {Math.round(entry.boostRatio * 100)}%
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {Math.round(entry.boostRatio * 100)}% of
                                      this roster read as boost accounts (very
                                      few random battles, used to inflate
                                      stronghold results). This discounts the SR.
                                    </TooltipContent>
                                  </Tooltip>
                                )}
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
                        <TableCell className="text-right font-bold tabular-nums">
                          {entry.sr !== null ? intFmt.format(entry.sr) : "—"}
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
