import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanSearchResponse } from "./schema.api";
import {
  discoverClans,
  searchClansLocalPart,
  searchClansRemotePart,
} from "./shared";

export const dynamic = "force-dynamic";

/**
 * Search clans
 * @description Search clans by name or tag prefix (minimum 3 characters). Returns the combined result set in a single JSON response: our database hits first, then Wargaming API hits (deduped). Waits for the (rate-limited) Wargaming call, so it can be slower than the streamed variant. For progressive results, use `/search/ndjson`.
 * @pathParams regionParams
 * @queryParams searchQuery
 * @response ClanSearchResponse
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

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const parsed = S.searchQuery.safeParse({ q });
  if (!parsed.success) {
    return jsonResponse(
      ClanSearchResponse,
      { results: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const query = parsed.data.q;

  const [local, remoteRaw] = await Promise.all([
    searchClansLocalPart(region, query),
    searchClansRemotePart(region, query),
  ]);
  const seen = new Set(local.map((r) => r.clan_id));
  const results = [...local, ...remoteRaw.filter((r) => !seen.has(r.clan_id))];

  discoverClans(region, results);
  return jsonResponse(
    ClanSearchResponse,
    { results },
    { headers: { "cache-control": "no-store" } },
  );
}
