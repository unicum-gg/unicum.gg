import { ratingMetricFromCookie } from "@unicum.gg/core/constants/rating";
import * as S from "@/services/openapi/schemas";
import {
  getTopPlayersByMetric,
  type TopPlayersPeriod,
  type TopPlayerResult,
} from "@unicum.gg/core/wargaming/wot/players/top";
import { isRegion } from "@unicum.gg/wargaming/region";

export type TopPlayersResponse = {
  results: TopPlayerResult[];
  computed_at: string | null;
};

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
    .catch("overall")
    .parse(url.searchParams.get("period")) as TopPlayersPeriod;
  const limit = Math.max(
    1,
    Math.min(
      S.PLAYERS_TOP_MAX_LIMIT,
      Number(url.searchParams.get("limit")) || S.TOP_DEFAULT_LIMIT,
    ),
  );
  const metric = ratingMetricFromCookie(url.searchParams.get("metric"));

  try {
    const { results, computedAt } = await getTopPlayersByMetric(
      region,
      metric,
      period,
      limit,
    );
    return Response.json({
      results,
      computed_at: computedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error(`[api/${region}/players/top] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
