import {
  searchMaps,
  type MapSearchResult,
} from "@unicum.gg/core/wargaming/wot/maps";
import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@unicum.gg/wargaming";
import { MapSearchResponse } from "./schema.api";

export const dynamic = "force-dynamic";

export type { MapSearchResult };

/**
 * Search maps
 * @description Search the battle-map catalogue by name (minimum 3 characters), served from our in-memory catalogue. Returns the results in a single JSON response. For the streamed variant (a single `local` chunk), use `/search/ndjson`.
 * @pathParams regionParams
 * @queryParams searchQuery
 * @response MapSearchResponse
 * @tag Maps
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
  const results = parsed.success ? await searchMaps(region, parsed.data.q, 5) : [];
  return jsonResponse(
    MapSearchResponse,
    { results },
    { headers: { "cache-control": "no-store" } },
  );
}
