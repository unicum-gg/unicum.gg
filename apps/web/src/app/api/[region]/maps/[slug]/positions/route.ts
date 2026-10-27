import { getMapPositions } from "@unicum.gg/core/maps/positions-read";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { MapPositionsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Map positions
 * @description Where players set up on a map and where they deal their damage from, over the last 90 days, read out of the replays archived through the unicum.gg mod, in every counted battle mode and grouped by the layout each battle was played on (Standard, Encounter, Assault, Onslaught's reduced area). Spots: the first place each vehicle held for twenty seconds in the first four minutes, with how its battle went (damage, kills, survived, won). Damage: every shot that landed, summed where it was fired from. Kills: each killing shot, placed where it was fired from. Only the recording player's team is placed, since a replay knows an enemy's position only while it is spotted and an enemy firing unseen is exactly the position worth knowing. 404 when the slug maps to no map on the region.
 * @pathParams mapParams
 * @response MapPositionsResponse
 * @tag Maps
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maps/{slug}/positions", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const map = await getMapDetailBySlug(region, decodeURIComponent(slug));
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });

  const arenas = [map.arenaId, ...map.variants.map((variant) => variant.arenaId)];
  return jsonResponse(
    MapPositionsResponse,
    await getMapPositions(region, map.arenaId, arenas),
    {
      headers: {
        // Rows land when a replay is uploaded, and nothing watches for it.
        "cache-control":
          "public, max-age=0, s-maxage=900, stale-while-revalidate=300",
      },
    },
  );
}
