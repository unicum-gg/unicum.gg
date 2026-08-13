import { resolveSearchEntries } from "@unicum.gg/core/search";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { SearchResolveResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/** Comma-separated ids, dropping anything that is not one. A stored list is
 * whatever a browser held, so a malformed entry is skipped rather than failing
 * the whole call and leaving the reader with no list at all. */
function idList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function numericIds(raw: string | null): number[] {
  return idList(raw)
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0);
}

/**
 * Resolve saved search entries
 * @description Current rows for a set of entries the caller has saved by id (the search dialog's favorites and recents), in the same shapes the four search endpoints return. Each list is optional and comma separated. Entries that no longer resolve are absent from the response rather than reported, so a caller can keep its own copy for those. Reads cached data only, with no live Wargaming call.
 * @pathParams regionParams
 * @queryParams searchResolveQuery
 * @response SearchResolveResponse
 * @tag System
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

  const query = new URL(req.url).searchParams;
  const resolved = await resolveSearchEntries(region, {
    players: numericIds(query.get("players")),
    clans: numericIds(query.get("clans")),
    tanks: numericIds(query.get("tanks")),
    maps: idList(query.get("maps")),
  });

  return jsonResponse(SearchResolveResponse, resolved, {
    // A pinned row is per-reader, and the whole point is that it is current, so
    // this is never worth a shared cache. It is two indexed reads.
    headers: { "cache-control": "no-store" },
  });
}
