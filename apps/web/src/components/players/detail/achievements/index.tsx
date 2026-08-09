"use client";

import { useMemo, useState } from "react";
import type { PlayerAchievements } from "@unicum.gg/shared";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, ChipRow } from "@/components/tanks/tank-filter-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Medal } from "./medal";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** Whether a medal is shown at all, independently of the text search. */
enum EarnedFilter {
  All = "all",
  Earned = "earned",
  Missing = "missing",
}

/** Retired event medals are more than half the catalogue (288 of 510), so they
 * are hidden by default: left in, the grid is mostly things nobody can earn any
 * more, and the completion counter reads as a failure it is not. */
enum OutdatedFilter {
  Current = "current",
  Outdated = "outdated",
  All = "all",
}

export function AchievementsTab({
  nickname,
  data,
  loading,
}: {
  nickname: string;
  data: PlayerAchievements | null;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [earned, setEarned] = useState(EarnedFilter.All);
  const [outdated, setOutdated] = useState(OutdatedFilter.Current);

  // Memoised, not just defaulted: `?? []` mints a fresh array on every render
  // while the fetch is in flight, which would invalidate both memos below on
  // each one and re-filter 510 rows for nothing.
  const all = useMemo(() => data?.achievements ?? [], [data]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((a) => {
      if (earned === EarnedFilter.Earned && a.count === 0) return false;
      if (earned === EarnedFilter.Missing && a.count > 0) return false;
      if (outdated === OutdatedFilter.Current && a.outdated) return false;
      if (outdated === OutdatedFilter.Outdated && !a.outdated) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, query, earned, outdated]);

  // Counted over what the availability filter admits, not the whole catalogue:
  // with retired medals hidden (the default) the headline has to be "77 of the
  // 217 you can still earn", not 77 of 505.
  const scope = useMemo(() => {
    const pool = all.filter((a) => {
      if (outdated === OutdatedFilter.Current && a.outdated) return false;
      if (outdated === OutdatedFilter.Outdated && !a.outdated) return false;
      return true;
    });
    return { earned: pool.filter((a) => a.count > 0).length, total: pool.length };
  }, [all, outdated]);

  // Section headers carry the per-section tally, which is why the grid needs no
  // section filter of its own: scrolling shows every section and its count.
  const grouped = useMemo(() => {
    const out: { id: string; name: string; items: typeof shown }[] = [];
    for (const a of shown) {
      const last = out.at(-1);
      if (last && last.id === a.section) last.items.push(a);
      else out.push({ id: a.section, name: a.sectionName, items: [a] });
    }
    return out;
  }, [shown]);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader className="flex flex-wrap items-center gap-3">
          <PanelTitle>{nickname}&apos;s achievements</PanelTitle>
          {!loading && data && (
            <span className="ml-auto flex items-baseline gap-2 text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {intFmt.format(scope.earned)} / {intFmt.format(scope.total)}
              </span>
              <span className="tabular-nums">
                {pctFmt.format(scope.total > 0 ? scope.earned / scope.total : 0)}
              </span>
            </span>
          )}
        </PanelHeader>

        {/* Same shape as the `/tanks` filter bar, reusing its `Chip`/`ChipRow`
            primitives rather than dropdowns: the choices here are three or four
            wide, so a segmented row shows the current state and every
            alternative at once, where a `<Select>` hides both behind a click. */}
        <PanelContent className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search among ${shown.length.toLocaleString("en-US")} achievements`}
            aria-label="Search achievements"
            disabled={loading}
            className="h-7 w-64 rounded-md border border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:border-fd-ring focus:outline-none"
          />

          <ChipRow>
            {[
              [EarnedFilter.All, "All"],
              [EarnedFilter.Earned, "Earned"],
              [EarnedFilter.Missing, "Missing"],
            ].map(([value, label]) => (
              <Chip
                key={value}
                active={earned === value}
                onClick={() => setEarned(value as EarnedFilter)}
              >
                {label}
              </Chip>
            ))}
          </ChipRow>

          <ChipRow>
            {[
              [OutdatedFilter.Current, "Obtainable"],
              [OutdatedFilter.Outdated, "Retired"],
              [OutdatedFilter.All, "Both"],
            ].map(([value, label]) => (
              <Chip
                key={value}
                active={outdated === value}
                onClick={() => setOutdated(value as OutdatedFilter)}
              >
                {label}
              </Chip>
            ))}
          </ChipRow>
        </PanelContent>
      </Panel>

      {loading ? (
        // Shaped like the grid it stands in for, the way the tank table's
        // skeleton mirrors its columns: same tile size and gap, so the real
        // medals drop into place without the page jumping.
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle className="text-sm text-muted-foreground uppercase">
                <Skeleton className="h-4 w-32" />
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="flex flex-wrap gap-2">
              {Array.from({ length: 24 }, (_, i) => (
                <Skeleton key={i} className="size-16 rounded-full sm:size-20" />
              ))}
            </PanelContent>
          </Panel>
        </>
      ) : shown.length === 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelContent>
              <p className="text-sm text-muted-foreground">
                No achievement matches these filters.
              </p>
            </PanelContent>
          </Panel>
        </>
      ) : (
        <TooltipProvider delayDuration={150}>
          {grouped.map((g) => (
            <div key={g.id}>
              <PanelSeparator />
              <Panel>
                <PanelHeader>
                  <PanelTitle className="text-sm text-muted-foreground uppercase">
                    {g.name}
                    <span className="ml-2 font-normal tabular-nums">
                      {g.items.filter((a) => a.count > 0).length} / {g.items.length}
                    </span>
                  </PanelTitle>
                </PanelHeader>
                <PanelContent className="flex flex-wrap gap-2">
                  {g.items.map((a) => (
                    <Medal key={a.id} achievement={a} />
                  ))}
                </PanelContent>
              </Panel>
            </div>
          ))}
        </TooltipProvider>
      )}
    </>
  );
}
