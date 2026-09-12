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
import { measured } from "@/services/perf";

/**
 * Top players
 * @description Player leaderboard for a region.
 * @pathParams regionParams
 * @queryParams playersTopQuery
 * @response TopPlayersResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/top", () => GET__perf(...args));
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

  // `lang` on the wire, because `language` elsewhere in the API asks for the
  // language the ANSWER is written in. This one selects rows, not prose. The
  // old name is still read, and deprecated in the document: dropping it outright
  // would answer an existing caller with a complete board rather than tell them
  // their filter was ignored.
  const lang =
    url.searchParams.get("lang") ?? url.searchParams.get("language");
  const withLanguages = url.searchParams.get("languages") === "true";
  const strict = url.searchParams.get("strict") === "true";

  try {
    if (lang || withLanguages) {
      // Language boards are lifetime WNX rankings scoped to clans declaring
      // the language (`strict` = the clan declares only that one).
      const results = await getTopPlayersByLanguage(
        region,
        metric,
        lang,
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
