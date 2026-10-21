import { isRegion } from "@unicum.gg/wargaming";
import { parseTierFloor } from "@unicum.gg/shared";
import { getPlayerLanguageStats } from "@/services/players/available-languages";
import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { TopPlayersPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period";
import { isRecentPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period-ratings";
import { getPeriodLanguageStats } from "@unicum.gg/core/wargaming/wot/players/top/period-board";
import { PlayerLanguagesResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Player languages
 * @description Languages the region's ranked players speak (inferred from their clan history), with total and strict (single-language) counts, over the pool of the requested leaderboard period (and tier floor, on a recent period). Backs the by-language leaderboards.
 * @pathParams regionParams
 * @queryParams playerLanguagesQuery
 * @response PlayerLanguagesResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/languages", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  // Counted over the pool the chosen board ranks, so a chip's count is the
  // number of rows behind it whichever window the reader is on.
  const query = new URL(req.url).searchParams;
  const period = S.periodField
    .catch(TopPlayersPeriod.Overall)
    .parse(query.get("period"));
  const results = isRecentPeriod(period)
    ? await getPeriodLanguageStats(
        region,
        period,
        parseTierFloor(query.get("min_tier")),
      )
    : await getPlayerLanguageStats(region);
  return jsonResponse(PlayerLanguagesResponse, { results });
}
