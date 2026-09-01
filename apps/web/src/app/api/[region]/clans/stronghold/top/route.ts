import { isRegion } from "@unicum.gg/wargaming";
import { attachClanBadges } from "@/services/clans/attach-badges";
import {
  StrongholdPeriod,
  StrongholdSort,
  StrongholdTier,
} from "@unicum.gg/shared";
import { getStrongholdLeaderboard } from "@/services/clans/stronghold-leaderboard";
import { jsonResponse } from "@/services/openapi/json-response";
import { StrongholdTopResponse } from "./schema.api";
import { measured } from "@/services/perf";

const LIMIT = 100;

const TIERS = new Set<string>(Object.values(StrongholdTier));
const SORTS = new Set<string>(Object.values(StrongholdSort));
const PERIODS = new Set<string>(Object.values(StrongholdPeriod));

/**
 * Stronghold clan leaderboard
 * @description The region's best stronghold clans for one mode/tier (Advances, tier X/VIII/VI skirmishes), ranked by SR (skirmish rating), Elo, battles, or win rate, over the last 24 hours, 7 days, 30 days, or all-time. Top 100; cached ~10 min server-side.
 * @pathParams regionParams
 * @queryParams strongholdTopQuery
 * @response StrongholdTopResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/stronghold/top", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const url = new URL(req.url);
  const tierParam = url.searchParams.get("tier") ?? StrongholdTier.T10;
  const tier = (
    TIERS.has(tierParam) ? tierParam : StrongholdTier.T10
  ) as StrongholdTier;
  const sortParam = url.searchParams.get("sort") ?? StrongholdSort.Rating;
  const sort = (
    SORTS.has(sortParam) ? sortParam : StrongholdSort.Rating
  ) as StrongholdSort;
  const periodParam = url.searchParams.get("period") ?? StrongholdPeriod.Overall;
  const period = (
    PERIODS.has(periodParam) ? periodParam : StrongholdPeriod.Overall
  ) as StrongholdPeriod;

  const results = await getStrongholdLeaderboard(
    region,
    tier,
    sort,
    period,
    LIMIT,
  );
  // A few batched indexed reads for the whole page, so every row carries the
  // placings it holds on the other boards and the tournaments it has won. This
  // board names its clan column `clanId`, so it is bridged to the shared
  // attacher's `clan_id` and back.
  const withIds = results.map((r) => ({ ...r, clan_id: r.clanId }));
  const decorated = await attachClanBadges(region, withIds);
  return jsonResponse(StrongholdTopResponse, {
    results: decorated.map((row) => {
      const { clan_id, ...rest } = row;
      void clan_id;
      return rest;
    }),
  });
}
