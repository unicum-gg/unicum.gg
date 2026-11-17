import { parseTierFloor, ratingMetricFromCookie } from "@unicum.gg/shared";
import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import {
  getTopPlayersByMetric,
  TopPlayersPeriod,
} from "@unicum.gg/core/wargaming/wot/players/top";
import { isRecentPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period-ratings";
import { getPeriodBoard } from "@unicum.gg/core/wargaming/wot/players/top/period-board";
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

  // The ranking behind this is rewritten once an hour by the top-players cron,
  // and the page that reads it was the only thing holding a cache: it is ISR,
  // so a reader never reached the endpoint at all. Paging does reach it, and an
  // uncached ordered scan of two million rows is 1.2 s a click, measured. The
  // window is well under the hour the data moves in, and `stale-while-
  // revalidate` means the one reader who lands on an expired entry is served
  // the old board rather than made to wait for the new one.
  const CACHE = {
    "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=300",
  };
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
  // Rows to skip. Bounded with the limit by the API's own maximum depth, which
  // is what the board publishes and as far as any reader can page.
  const offset = Math.max(
    0,
    Math.min(S.PLAYERS_TOP_MAX_LIMIT, Number(url.searchParams.get("offset")) || 0),
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
    // A recent window reads its own materialized pool, which carries the
    // inferred languages, so it filters by language exactly like the lifetime
    // board does below, over every account the window ranks.
    if (isRecentPeriod(period)) {
      const { results, computedAt } = await getPeriodBoard(region, {
        metric,
        period,
        minTier: parseTierFloor(url.searchParams.get("min_tier")),
        language: lang,
        strict,
        limit,
      });
      return jsonResponse(
        TopPlayersResponse,
        {
          results: await attachPlayerBadges(region, results),
          computed_at: computedAt?.toISOString() ?? null,
        },
        { headers: CACHE },
      );
    }
    if (lang || withLanguages) {
      // The lifetime language board, scoped to clans declaring the language
      // (`strict` = the clan declares only that one).
      const { results, computedAt, total } = await getTopPlayersByLanguage(
        region,
        metric,
        lang,
        limit,
        strict,
        offset,
        S.PLAYERS_TOP_MAX_LIMIT,
      );
      return jsonResponse(
        TopPlayersResponse,
        {
          results: await attachPlayerBadges(region, results),
          computed_at: computedAt?.toISOString() ?? null,
          total,
        },
        { headers: CACHE },
      );
    }
    const { results, computedAt } = await getTopPlayersByMetric(
      region,
      metric,
      period,
      limit,
    );
    return jsonResponse(
      TopPlayersResponse,
      {
        results: await attachPlayerBadges(region, results),
        computed_at: computedAt?.toISOString() ?? null,
      },
      { headers: CACHE },
    );
  } catch (err) {
    console.error(`[api/${region}/players/top] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
