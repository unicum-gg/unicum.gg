import { ratingMetricFromCookie } from "@unicum.gg/shared";
import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import {
  getTopPlayersByMetric,
  TopPlayersPeriod,
} from "@unicum.gg/core/wargaming/wot/players/top";
import { getTopPlayersByLanguage } from "@/services/wargaming/wot/players/top/by-language";
import { attachPlayerBadges } from "@/services/players/attach-badges";
import { isRegion } from "@unicum.gg/wargaming";
import { TopPlayersResponse } from "./schema.api";

/**
 * Top players
 * @description Player leaderboard for a region.
 * @pathParams regionParams
 * @queryParams playersTopQuery
 * @response TopPlayersResponse
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
  // `periodField` enum values match `TopPlayersPeriod`; `.catch` mirrors the
  // old `parsePeriod` (unknown/missing -> overall).
  const period = S.periodField
    .catch(TopPlayersPeriod.Overall)
    .parse(url.searchParams.get("period"));
  const limit = Math.max(
    1,
    Math.min(
      S.PLAYERS_TOP_MAX_LIMIT,
      Number(url.searchParams.get("limit")) || S.TOP_DEFAULT_LIMIT,
    ),
  );
  const metric = ratingMetricFromCookie(url.searchParams.get("metric"));

  const language = url.searchParams.get("language");
  const withLanguages = url.searchParams.get("languages") === "true";
  const strict = url.searchParams.get("strict") === "true";

  try {
    if (language || withLanguages) {
      // Language boards are lifetime WNX rankings scoped to clans declaring
      // the language (`strict` = the clan declares only that one).
      const results = await getTopPlayersByLanguage(
        region,
        metric,
        language,
        limit,
        strict,
      );
      return jsonResponse(TopPlayersResponse, {
        results: await attachPlayerBadges(region, results),
        computed_at: null,
      });
    }
    const { results, computedAt } = await getTopPlayersByMetric(
      region,
      metric,
      period,
      limit,
    );
    return jsonResponse(TopPlayersResponse, {
      results: await attachPlayerBadges(region, results),
      computed_at: computedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error(`[api/${region}/players/top] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
