import { isRegion } from "@unicum.gg/wargaming";
import { StrongholdSort, StrongholdTier } from "@unicum.gg/shared";
import { getStrongholdLeaderboard } from "@/services/clans/stronghold-leaderboard";
import { jsonResponse } from "@/services/openapi/json-response";
import { StrongholdTopResponse } from "./schema.api";

const LIMIT = 100;

const TIERS = new Set<string>(Object.values(StrongholdTier));
const SORTS = new Set<string>(Object.values(StrongholdSort));

/**
 * Stronghold clan leaderboard
 * @description The region's best stronghold clans for one mode/tier (Advances, tier X/VIII/VI skirmishes), ranked by Elo (or battles for Advances, which has no Elo). Top 100; cached ~10 min server-side.
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
  // Advances has no Elo, so its natural ranking is battles.
  const defaultSort =
    tier === StrongholdTier.Advances
      ? StrongholdSort.Battles
      : StrongholdSort.Elo;
  const sortParam = url.searchParams.get("sort") ?? defaultSort;
  const sort = (
    SORTS.has(sortParam) ? sortParam : defaultSort
  ) as StrongholdSort;

  const results = await getStrongholdLeaderboard(region, tier, sort, LIMIT);
  return jsonResponse(StrongholdTopResponse, { results });
}
