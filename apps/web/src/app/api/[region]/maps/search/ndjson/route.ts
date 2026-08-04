import { SearchSource } from "@unicum.gg/shared";
import {
  searchMaps,
  type MapSearchResult,
} from "@unicum.gg/core/wargaming/wot/maps";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@unicum.gg/wargaming";

export const dynamic = "force-dynamic";

/** One NDJSON line of the streamed map search response. Maps come entirely from
 * our in-memory catalogue, so there is only ever a single `local` chunk. */
export type MapSearchChunk = {
  source: SearchSource;
  results: MapSearchResult[];
};

/**
 * Search maps (streamed)
 * @description Search the battle-map catalogue by name (minimum 3 characters). Streams NDJSON with a single `local` chunk served from our in-memory catalogue. For a plain JSON response, use `/search`.
 * @pathParams regionParams
 * @queryParams searchQuery
 * @response MapSearchChunk
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
  const body = `${JSON.stringify({ source: SearchSource.Local, results })}\n`;
  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
