import {
  DEFAULT_MARKS_SORT,
  isMarksSort,
  MARKS_MIN_BATTLES,
} from "@unicum.gg/shared";
import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { attachPlayerBadges } from "@/services/players/attach-badges";
import {
  getMarksBoard,
  getMarksBoardMeta,
} from "@unicum.gg/core/players/marks-board";
import { isRegion } from "@unicum.gg/wargaming";
import { PlayerMarksResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Marks of Excellence leaderboard
 * @description Players ranked by how many guns carry three Marks of Excellence, in total or at one tier. `tiers` names the tiers with a ranking, `coverage` says which accounts it is drawn from.
 *
 * One line, because next-openapi-gen keeps only the first line of a
 * `@description` and silently drops the rest (the Steel Hunter route's reads as
 * a sentence cut in half for exactly that reason).
 *
 * Marks are absent from Wargaming's public API, so they are read from the game
 * portal one account at a time, which only happens when somebody looks a
 * profile up. The board therefore ranks the accounts whose garage we have read
 * rather than the whole region, and `coverage` carries both numbers so a caller
 * can say so too.
 * @pathParams regionParams
 * @queryParams playerMarksQuery
 * @response PlayerMarksResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/marks", () => GET__perf(...args));
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
  const sort = isMarksSort(sortParam) ? sortParam : DEFAULT_MARKS_SORT;
  // `lang` only, with no `language` alias: this endpoint is new, so there is no
  // caller to keep answering for, and the two names mean different things
  // elsewhere in the API (see `langField`).
  const lang = url.searchParams.get("lang");
  const strict = url.searchParams.get("strict") === "true";

  try {
    const [results, meta] = await Promise.all([
      getMarksBoard(region, { sort, limit, language: lang, strict }),
      getMarksBoardMeta(region),
    ]);
    const { coverage } = meta;
    return jsonResponse(PlayerMarksResponse, {
      results: (await attachPlayerBadges(region, results)).map((row) => ({
        ...row,
        measured_at: row.measured_at.toISOString(),
      })),
      tiers: meta.tiers,
      languages: meta.languages,
      coverage: {
        ranked: coverage.ranked,
        measured: coverage.measured,
        tracked: coverage.tracked,
        min_battles: MARKS_MIN_BATTLES,
        newest: coverage.newest?.toISOString() ?? null,
        oldest: coverage.oldest?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error(`[api/${region}/players/marks] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
