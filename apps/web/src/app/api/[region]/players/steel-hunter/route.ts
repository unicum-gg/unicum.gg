import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { getTopSteelHunter } from "@unicum.gg/core/wargaming/wot/players/steel-hunter";
import { DEFAULT_STEEL_HUNTER_SORT, isSteelHunterSort } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";
import { SteelHunterResponse } from "./schema.api";

/**
 * Steel Hunter leaderboard
 * @description The Steel Hunter (battle-royale) player leaderboard for a region,
 * ranked by the chosen `sort` column (HR by default). Only players with at
 * least 100 Steel Hunter battles are ranked.
 * @pathParams regionParams
 * @queryParams steelHunterQuery
 * @response SteelHunterResponse
 * @tag Players
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
  const limit = Math.max(
    1,
    Math.min(
      S.PLAYERS_TOP_MAX_LIMIT,
      Number(url.searchParams.get("limit")) || S.TOP_DEFAULT_LIMIT,
    ),
  );
  const sortParam = url.searchParams.get("sort") ?? "";
  const sort = isSteelHunterSort(sortParam)
    ? sortParam
    : DEFAULT_STEEL_HUNTER_SORT;

  try {
    const results = await getTopSteelHunter(region, limit, sort);
    return jsonResponse(SteelHunterResponse, { results });
  } catch (err) {
    console.error(`[api/${region}/players/steel-hunter] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
