import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { attachPlayerBadges } from "@/services/players/attach-badges";
import { getOnslaughtLeaderboard } from "@unicum.gg/core/wargaming/wot/players/onslaught";
import { isRegion } from "@unicum.gg/wargaming";
import { OnslaughtResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Onslaught leaderboard
 * @description The Onslaught (Competitive 7) ranked leaderboard for a region,
 * in the game's own rank order (best first). Standings are mirrored from the
 * in-game source into our database, so past seasons stay available after the
 * source drops them.
 * @pathParams regionParams
 * @queryParams onslaughtQuery
 * @response OnslaughtResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/onslaught", () => GET__perf(...args));
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
      S.ONSLAUGHT_MAX_LIMIT,
      Number(url.searchParams.get("limit")) || S.ONSLAUGHT_MAX_LIMIT,
    ),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const season = url.searchParams.get("season") ?? undefined;

  try {
    const {
      season: current,
      seasons,
      results,
      aggregates,
      dropouts,
      lost,
      previous,
    } = await getOnslaughtLeaderboard(region, limit, season, offset);
    // Both lists wear the same crests, and both resolve them in one batch each.
    // Over the PAGE rather than over the board: a crest is drawn on the rows a
    // reader sees, and resolving a few thousand of them to publish a hundred is
    // a batch query per request for nothing.
    const [decorated, fallen] = await Promise.all([
      attachPlayerBadges(region, results),
      attachPlayerBadges(region, dropouts),
    ]);
    return jsonResponse(OnslaughtResponse, {
      season: current,
      seasons,
      previous,
      results: decorated,
      aggregates,
      dropouts: fallen,
      lost,
    });
  } catch (err) {
    console.error(`[api/${region}/players/onslaught] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
