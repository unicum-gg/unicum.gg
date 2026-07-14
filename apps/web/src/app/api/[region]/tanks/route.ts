import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { TankPerfResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Tanks performance
 * @description Server-wide performance for every tank on a region, averaged over tracked players: win rate, average damage, WN7/WN8/WNX, kills-per-death, assistance, spots, hit and penetration rate, blocked damage and survival, plus Marks of Excellence / Mastery holder counts. One row per vehicle in the region's catalogue; `stats` is null until the by-tank cron has coverage.
 * @pathParams regionParams
 * @response TankPerfResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const dataset = await getTankDataset(region);
  const results = dataset.map((r) => ({ identity: r.identity, stats: r.stats }));

  return jsonResponse(
    TankPerfResponse,
    { results },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
