import { StrongholdLeaderboardView } from "./view";
import type { StrongholdLeaderboardEntry } from "@/services/clans/stronghold-leaderboard";
import { buildSafe, unicum } from "@/services/sdk";
import {
  StrongholdPeriod,
  StrongholdSort,
  StrongholdTier,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";


function parseTier(raw: string): StrongholdTier | null {
  return (Object.values(StrongholdTier) as string[]).includes(raw)
    ? (raw as StrongholdTier)
    : null;
}

// This is the prerendered (ISR) canonical render: default sort (SR) + Overall
// period, no searchParams and no cookie read (that would opt the page back into
// dynamic and defeat the whole point). The view seeds these results as the SWR
// fallback, then swaps sort/period client-side via the SDK and re-applies any
// `?sort=`/`?period=` deep link or the shared `unicum.period` cookie on mount.
export async function StrongholdLeaderboardPage({
  region,
  tierParam,
}: {
  region: Region;
  tierParam: string;
}) {
  const tier = parseTier(tierParam) ?? StrongholdTier.T10;
  const sort = StrongholdSort.Rating;
  const period = StrongholdPeriod.Overall;
  // The page consumes its own public API through the SDK (top 100 fixed by
  // the endpoint). `buildSafe` lets a DB-less prerender emit an empty shell
  // that heals on first revalidation, like the other ISR boards.
  const { results } = (await buildSafe(
    () => unicum.region(region).clans.strongholdTop({ tier, sort, period }),
    { results: [] },
  )) as unknown as {
    results: StrongholdLeaderboardEntry[];
  };

  return (
    <StrongholdLeaderboardView
      region={region}
      tier={tier}
      initialResults={results}
    />
  );
}
