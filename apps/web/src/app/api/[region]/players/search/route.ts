import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { attachPlayerBadges } from "@/services/players/attach-badges";
import { isRegion } from "@unicum.gg/wargaming";
import { PlayerSearchResponse } from "./schema.api";
import {
  discoverPlayers,
  searchPlayersLocalPart,
  searchPlayersRemotePart,
  type SearchPlayerResult,
} from "./shared";
import { measured } from "@/services/perf";

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
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/search", () => GET__perf(...args));
}
async function GET__perf(
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

  // Never let a slow/rate-limited WG call hold the whole search hostage: race the
  // remote part against a short timeout and fall back to the DB hits. Under WG
  // budget pressure the interactive lane can queue for tens of seconds, and the
  // WG hits are a bonus (deduped extras), never a blocker for the local results.
  const REMOTE_TIMEOUT_MS = 1500;
  const remote: Promise<SearchPlayerResult[]> = Promise.race([
    searchPlayersRemotePart(region, query),
    new Promise<SearchPlayerResult[]>((resolve) =>
      setTimeout(() => resolve([]), REMOTE_TIMEOUT_MS),
    ),
  ]).catch((err) => {
    console.error(`[api/${region}/players/search] remote failed:`, err);
    return [] as SearchPlayerResult[];
  });
  const [local, remoteRaw] = await Promise.all([
    searchPlayersLocalPart(region, query),
    remote,
  ]);
  const seen = new Set(local.map((r) => r.account_id));
  const results = [...local, ...remoteRaw.filter((r) => !seen.has(r.account_id))];

  discoverPlayers(region, results);
  return jsonResponse(
    PlayerSearchResponse,
    { results: await attachPlayerBadges(region, results) },
    { headers: { "cache-control": "no-store" } },
  );
}
