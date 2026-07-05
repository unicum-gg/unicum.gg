import { ratingMetricFromCookie } from "@unicum.gg/core/constants/rating";
import * as S from "@/services/openapi/schemas";
import {
  getTopClansByMetric,
  type TopClanResult,
  TopClansPeriod,
} from "@unicum.gg/core/wargaming/wot/clans/top";
import { isRegion } from "@unicum.gg/wargaming/region";

export type TopClansResponse = {
  results: TopClanResult[];
  computed_at: string | null;
};

/**
 * Top clans
 * @description Clan leaderboard for a region.
 * @pathParams regionParams
 * @queryParams clansTopQuery
 * @response TopClansResponse
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
  // `clanPeriodField` enum values match `TopClansPeriod`; unknown/missing falls
  // back to the lifetime ranking.
  const period = S.clanPeriodField
    .catch("overall")
    .parse(url.searchParams.get("period")) as TopClansPeriod;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(
      S.CLANS_TOP_MAX_LIMIT,
      Number(limitParam) || S.TOP_DEFAULT_LIMIT,
    ),
  );
  // Caller may pin a metric via ?metric=wn7|wn8|wnx; otherwise default.
  const metric = ratingMetricFromCookie(url.searchParams.get("metric"));

  try {
    const { results, computedAt } = await getTopClansByMetric(
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
    console.error(`[api/${region}/clans/top] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
