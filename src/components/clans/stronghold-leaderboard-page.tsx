import { Suspense } from "react";
import { StrongholdLeaderboardView } from "./stronghold-leaderboard-view";
import { StrongholdTierTabs } from "@/components/clans/stronghold-tier-tabs";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TableSkeleton, type SkeletonColumn } from "@/components/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { getStrongholdLeaderboard } from "@/services/clans/stronghold-leaderboard";
import {
  StrongholdSort,
  StrongholdTier,
  STRONGHOLD_MIN_BATTLES,
  STRONGHOLD_SORT_LABEL,
  STRONGHOLD_TIER_LABEL,
  TIER_SORT_OPTIONS,
} from "@/constants/stronghold";
import type { Region } from "@/services/wargaming/wot";
import { REGION_EMOJI, REGION_LABEL } from "@/services/wargaming/wot";

const LIMIT = 100;

const TABLE_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-6", align: "center" }, // #
  { width: "w-40", avatar: true }, // Clan (emblem + name)
  { width: "w-10", align: "center" }, // Members
  { width: "w-12", align: "right" }, // ELO
  { width: "w-14", align: "right" }, // Battles
  { width: "w-16", align: "right" }, // 30d battles
  { width: "w-12", align: "right" }, // WR
];

function parseTier(raw: string): StrongholdTier | null {
  return (Object.values(StrongholdTier) as string[]).includes(raw)
    ? (raw as StrongholdTier)
    : null;
}

function parseSort(
  raw: string | undefined,
  tier: StrongholdTier,
): StrongholdSort {
  const allowed = TIER_SORT_OPTIONS[tier];
  const found = allowed.find((s) => s === raw);
  return found ?? allowed[0];
}

// Shell (title + tier tabs) renders immediately; the ~1-3s leaderboard query
// streams into the Suspense boundary so switching tiers/sort shows the header
// and tabs instantly.
export function StrongholdLeaderboardPage({
  region,
  tierParam,
  sortParam,
}: {
  region: Region;
  tierParam: string;
  sortParam?: string;
}) {
  const tier = parseTier(tierParam) ?? StrongholdTier.T10;
  const sort = parseSort(sortParam, tier);

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

      <Suspense fallback={<StrongholdTableSkeleton />}>
        <StrongholdLeaderboardTable region={region} tier={tier} sort={sort} />
      </Suspense>
    </div>
  );
}

async function StrongholdLeaderboardTable({
  region,
  tier,
  sort,
}: {
  region: Region;
  tier: StrongholdTier;
  sort: StrongholdSort;
}) {
  const results = await getStrongholdLeaderboard(region, tier, sort, LIMIT);
  return (
    <StrongholdLeaderboardView
      region={region}
      tier={tier}
      sort={sort}
      results={results}
    />
  );
}

function StrongholdTableSkeleton() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <Skeleton className="h-6 w-52 max-w-full" />
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <TableSkeleton
          columns={TABLE_SKELETON_COLUMNS}
          rows={20}
          cellPaddingClass="[&_td]:py-2!"
        />
      </PanelContent>
    </Panel>
  );
}
