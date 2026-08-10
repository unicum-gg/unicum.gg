import { isRegion } from "@unicum.gg/wargaming";
import { resolveClanBadges } from "@unicum.gg/core/clans/badges";
import {
  StrongholdPeriod,
  StrongholdSort,
  StrongholdTier,
} from "@unicum.gg/shared";
import { getStrongholdLeaderboard } from "@/services/clans/stronghold-leaderboard";
import { jsonResponse } from "@/services/openapi/json-response";
import { StrongholdTopResponse } from "./schema.api";

const LIMIT = 100;

const TIERS = new Set<string>(Object.values(StrongholdTier));
const SORTS = new Set<string>(Object.values(StrongholdSort));
const PERIODS = new Set<string>(Object.values(StrongholdPeriod));

/**
 * Stronghold clan leaderboard
 * @description The region's best stronghold clans for one mode/tier (Advances, tier X/VIII/VI skirmishes), ranked by SR (skirmish rating), Elo, battles, or win rate, over all-time or the last 30 days. Top 100; cached ~10 min server-side.
 * @pathParams regionParams
 * @queryParams strongholdTopQuery
 * @response StrongholdTopResponse
 * @tag Clans
 * @openapi
 */
export async function GET(
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
  // One batched pair of indexed reads for the whole page, so every row can
  // carry the placings it holds on the other boards.
  const byClan = await resolveClanBadges(
    region,
    results.map((r) => r.clanId),
  );
  return jsonResponse(StrongholdTopResponse, {
    results: results.map((r) => {
      const badges = byClan.get(r.clanId);
      return badges?.length ? { ...r, badges } : r;
    }),
  });
}
