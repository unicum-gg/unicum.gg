"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { StrongholdRatingScale } from "@/components/clans/list/stronghold/rating-scale";
import {
  type RankedStrongholdEntry,
  StrongholdTable,
} from "@/components/clans/list/stronghold/table";
import { StrongholdTierTabs } from "@/components/clans/list/stronghold/tier-tabs";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import { StrongholdPeriod, StrongholdSort, StrongholdTier, STRONGHOLD_MIN_BATTLES, STRONGHOLD_PERIOD_LABEL, STRONGHOLD_SORT_LABEL, STRONGHOLD_TIER_LABEL, TIER_SORT_OPTIONS } from "@unicum.gg/shared";
import type { StrongholdLeaderboardEntry } from "@/services/clans/stronghold-leaderboard";
import { unicum } from "@/services/sdk";
import { type Period, usePeriod, isPeriod } from "@/hooks/use-period";
import { type Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

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

  // Rank the server ordering once, before any narrowing, so the # column keeps
  // each clan's true standing when the filter bar hides the rows above it.
  const ranked = useMemo<RankedStrongholdEntry[]>(
    () => results.map((entry, i) => ({ ...entry, rank: i + 1 })),
    [results],
  );
  const searchFields = useCallback(
    (r: RankedStrongholdEntry) => [r.tag, r.name],
    [],
  );
  const rangeCols = useMemo<RangeColumn<RankedStrongholdEntry>[]>(
    () => [
      { key: "sr", label: "SR", value: (r) => r.sr },
      { key: "srb", label: "SRB", value: (r) => r.srb },
      { key: "elo", label: "ELO", value: (r) => r.elo },
      { key: "battles", label: "Battles", value: (r) => r.battles },
      {
        key: "winrate",
        label: "WR %",
        value: (r) => (r.battles > 0 ? (r.wins / r.battles) * 100 : null),
      },
      { key: "members", label: "Members", value: (r) => r.membersCount },
    ],
    [],
  );
  // The board is a single table (unlike the three metric boards on /clans), so
  // the filter can own `?q=&rc=&min=&max=` without fighting a sibling over them.
  const { filtered, filters } = useLeaderboardFilter(ranked, {
    searchFields,
    rangeCols,
    initialRangeCol: "sr",
    syncUrl: true,
  });

  // Reflect sort/period in the URL without a Next navigation (a plain
  // `history.replaceState`, so no RSC round-trip), keeping the Overall/SR URL
  // clean. This preserves shareable deep links, which the mount effect re-reads.
  function syncUrl(nextSort: StrongholdSort, nextPeriod: StrongholdPeriod) {
    // Read the live params rather than starting empty: the filter bar writes its
    // own keys there, and a fresh set would drop them on the next sort click.
    const params = new URLSearchParams(window.location.search);
    if (nextSort !== StrongholdSort.Rating) params.set("sort", nextSort);
    else params.delete("sort");
    if (nextPeriod !== StrongholdPeriod.Overall)
      params.set("period", nextPeriod);
    else params.delete("period");
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
            <>
              <div className="border-b border-fd-border px-4 py-2.5">
                <LeaderboardFilterBar filters={filters} searchNoun="clans" />
              </div>
              <StrongholdTable
                region={region}
                tier={tier}
                sort={sort}
                onSort={setSort}
                rows={filtered}
              />
            </>
          )}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Rating scale</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <StrongholdRatingScale />
        </PanelContent>
      </Panel>
    </div>
  );
}
