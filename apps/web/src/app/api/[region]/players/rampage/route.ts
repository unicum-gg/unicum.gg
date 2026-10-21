import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { attachPlayerBadges } from "@/services/players/attach-badges";
import { getTopRampage } from "@unicum.gg/core/wargaming/wot/players/rampage";
import { DEFAULT_RAMPAGE_SORT, isRampageSort } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";
import { RampageResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Rampage leaderboard
 * @description The Rampage player leaderboard for a region, ranked by the chosen `sort` column (MR by default). Only players with at least 100 Rampage battles are ranked. Rampage is the 2015 event Wargaming carries as `statistics.fallout`, which this board was published as "Steel Hunter" until October 2026; the two are different modes and Wargaming publishes no Steel Hunter statistics at all. It ended in May 2016, so the ranking is an archive: no row in it can move again.
 * @pathParams regionParams
 * @queryParams rampageQuery
 * @response RampageResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/rampage", () => GET__perf(...args));
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
  const limit = Math.max(
    1,
    Math.min(
      S.PLAYERS_TOP_MAX_LIMIT,
      Number(url.searchParams.get("limit")) || S.TOP_DEFAULT_LIMIT,
    ),
  );
  const sortParam = url.searchParams.get("sort") ?? "";
  const sort = isRampageSort(sortParam)
    ? sortParam
    : DEFAULT_RAMPAGE_SORT;

  try {
    const results = await getTopRampage(region, limit, sort);
    return jsonResponse(RampageResponse, {
      results: await attachPlayerBadges(region, results),
      computed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[api/${region}/players/rampage] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
