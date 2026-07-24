import { cookies } from "next/headers";
import { StrongholdLeaderboardView } from "./view";
import type { StrongholdLeaderboardEntry } from "@/services/clans/stronghold-leaderboard";
import { unicum } from "@/services/sdk";
import STORAGE from "@/constants/storage";
import {
  StrongholdPeriod,
  StrongholdSort,
  StrongholdTier,
  TIER_SORT_OPTIONS,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";


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

function parsePeriod(raw: string | undefined): StrongholdPeriod {
  return (Object.values(StrongholdPeriod) as string[]).includes(raw ?? "")
    ? (raw as StrongholdPeriod)
    : StrongholdPeriod.Overall;
}

export async function StrongholdLeaderboardPage({
  region,
  tierParam,
  sortParam,
  periodParam,
}: {
  region: Region;
  tierParam: string;
  sortParam?: string;
  periodParam?: string;
}) {
  const tier = parseTier(tierParam) ?? StrongholdTier.T10;
  const sort = parseSort(sortParam, tier);
  // Period sync: an explicit `?period=` (a shared link, or a click on this page)
  // wins; otherwise fall back to the shared `unicum.period` cookie so the choice
  // made on the home leaderboards carries over (the values match). The view
  // writes the same cookie on change, keeping the two in sync both ways.
  const cookiePeriod = periodParam
    ? undefined
    : (await cookies()).get(STORAGE.COOKIES.PERIOD)?.value;
  const period = parsePeriod(periodParam ?? cookiePeriod);
  // The page consumes its own public API through the SDK (top 100 fixed by
  // the endpoint).
  const { results } = (await unicum
    .region(region)
    .clans.strongholdTop({ tier, sort, period })) as unknown as {
    results: StrongholdLeaderboardEntry[];
  };

  return (
    <StrongholdLeaderboardView
      region={region}
      tier={tier}
      sort={sort}
      period={period}
      results={results}
    />
  );
}
