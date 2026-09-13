import { resolveSearchEntries } from "@unicum.gg/core/search";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { idList, numericIds } from "@/services/openapi/id-list";
import { SearchResolveResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Resolve saved search entries
 * @description Current rows for a set of entries the caller has saved by id (the search dialog's favorites and recents), in the same shapes the four search endpoints return. Each list is optional and comma separated. Entries that no longer resolve are absent from the response rather than reported, so a caller can keep its own copy for those. Reads cached data only, with no live Wargaming call.
 * @pathParams regionParams
 * @queryParams searchResolveQuery
 * @response SearchResolveResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/search/resolve", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const query = new URL(req.url).searchParams;
  const resolved = await resolveSearchEntries(region, {
    players: numericIds(query, "players"),
    clans: numericIds(query, "clans"),
    tanks: numericIds(query, "tanks"),
    maps: idList(query, "maps"),
  });

  return jsonResponse(SearchResolveResponse, resolved, {
    // A pinned row is per-reader, and the whole point is that it is current, so
    // this is never worth a shared cache. It is two indexed reads.
    headers: { "cache-control": "no-store" },
  });
}
