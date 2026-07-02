import { StrongholdLeaderboardView } from "./stronghold-leaderboard-view";
import { getStrongholdLeaderboard } from "@/services/clans/stronghold-leaderboard";
import {
  StrongholdSort,
  StrongholdTier,
  TIER_SORT_OPTIONS,
} from "@/constants/stronghold";
import type { Region } from "@/services/wargaming/wot";

const LIMIT = 100;

function parseTier(raw: string): StrongholdTier | null {
  return (Object.values(StrongholdTier) as string[]).includes(raw)
    ? (raw as StrongholdTier)
    : null;
}

function parseSort(raw: string | undefined, tier: StrongholdTier): StrongholdSort {
  const allowed = TIER_SORT_OPTIONS[tier];
  const found = allowed.find((s) => s === raw);
  return found ?? allowed[0];
}

export async function StrongholdLeaderboardPage({
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
