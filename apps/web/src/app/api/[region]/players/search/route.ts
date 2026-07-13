import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@unicum.gg/wargaming/region";
import { PlayerSearchResponse } from "./schema.api";
import {
  discoverPlayers,
  searchPlayersLocalPart,
  searchPlayersRemotePart,
  type SearchPlayerResult,
} from "./shared";

export const dynamic = "force-dynamic";

export type { SearchPlayerResult };

/**
 * Search players
 * @description Search players by nickname prefix (minimum 3 characters). Returns the combined result set in a single JSON response: our database hits first, then Wargaming API hits (deduped). Waits for the (rate-limited) Wargaming call, so it can be slower than the streamed variant. For progressive results, use `/search/ndjson`.
 * @pathParams regionParams
 * @queryParams searchQuery
 * @response PlayerSearchResponse
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

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const parsed = S.searchQuery.safeParse({ q });
  if (!parsed.success) {
    return jsonResponse(
      PlayerSearchResponse,
      { results: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const query = parsed.data.q;

  const [local, remoteRaw] = await Promise.all([
    searchPlayersLocalPart(region, query),
    searchPlayersRemotePart(region, query).catch((err) => {
      console.error(`[api/${region}/players/search] remote failed:`, err);
      return [] as SearchPlayerResult[];
    }),
  ]);
  const seen = new Set(local.map((r) => r.account_id));
  const results = [...local, ...remoteRaw.filter((r) => !seen.has(r.account_id))];

  discoverPlayers(region, results);
  return jsonResponse(
    PlayerSearchResponse,
    { results },
    { headers: { "cache-control": "no-store" } },
  );
}
