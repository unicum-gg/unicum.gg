import {
  searchTanks,
  type TankSearchResult,
} from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { jsonResponse } from "@/services/openapi/json-response";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@unicum.gg/wargaming";
import { TankSearchResponse } from "./schema.api";

export const dynamic = "force-dynamic";

export type { TankSearchResult };

/**
 * Search tanks
 * @description Search the vehicle catalogue by name, short name or tag (minimum 3 characters), served from our in-memory catalogue. Returns the results in a single JSON response. For the streamed variant (a single `local` chunk), use `/search/ndjson`.
 * @pathParams regionParams
 * @queryParams searchQuery
 * @response TankSearchResponse
 * @tag Tanks
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
  const results = parsed.success ? await searchTanks(region, parsed.data.q, 5) : [];
  return jsonResponse(
    TankSearchResponse,
    { results },
    { headers: { "cache-control": "no-store" } },
  );
}
