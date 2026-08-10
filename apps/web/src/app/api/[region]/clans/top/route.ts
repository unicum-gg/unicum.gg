import { ratingMetricFromCookie } from "@unicum.gg/shared";
import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import {
  getTopClansByMetric,
  TopClansPeriod,
} from "@unicum.gg/core/wargaming/wot/clans/top";
import { getTopClansByLanguage } from "@/services/wargaming/wot/clans/top/by-language";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { resolveClanBadges } from "@unicum.gg/core/clans/badges";
import { TopClansResponse } from "./schema.api";

/**
 * Attach each row's podium positions. One batched pair of indexed reads for the
 * whole page (~30 ms for 100 clans), so it is cheap enough to run on every
 * board rather than only the headline one. Rows with no podium simply keep no
 * `badges` key.
 */
async function withBadges<T extends { clan_id: number }>(
  region: Region,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const byClan = await resolveClanBadges(
    region,
    rows.map((r) => r.clan_id),
  );
  return rows.map((r) => {
    const badges = byClan.get(r.clan_id);
    return badges?.length ? { ...r, badges } : r;
  });
}

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

  const language = url.searchParams.get("language");
  const withLanguages = url.searchParams.get("languages") === "true";
  const strict = url.searchParams.get("strict") === "true";

  try {
    if (language || withLanguages) {
      // Language boards are lifetime WNX rankings scoped to clans declaring
      // the language (`strict` = the clan declares only that one).
      const results = await getTopClansByLanguage(
        region,
        metric,
        language,
        limit,
        strict,
      );
      return jsonResponse(TopClansResponse, {
        results: await withBadges(region, results),
        computed_at: null,
      });
    }
    const { results, computedAt } = await getTopClansByMetric(
      region,
      metric,
      period,
      limit,
    );
    return jsonResponse(TopClansResponse, {
      results: await withBadges(region, results),
      computed_at: computedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error(`[api/${region}/clans/top] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
