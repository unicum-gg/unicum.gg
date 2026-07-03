import { discoverClansBackground } from "@/services/discovery/clans";
import {
  findClansByPrefix,
  type ClanSearchResult,
} from "@/services/wargaming/wot/clans/search";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@/services/wargaming/wot";

export const dynamic = "force-dynamic";

export type ClanSearchResponse = {
  results: ClanSearchResult[];
};

/**
 * Search clans
 * @description Search clans by name or tag prefix (minimum 3 characters).
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
    return Response.json({ results: [] });
  }

  try {
    const results = await findClansByPrefix(region, parsed.data.q, 5);
    discoverClansBackground(
      region,
      results.map((r) => r.clan_id),
    );
    return Response.json({ results });
  } catch (err) {
    console.error(`[api/${region}/clans/search] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
