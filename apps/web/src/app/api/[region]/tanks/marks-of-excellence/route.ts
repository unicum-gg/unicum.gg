import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { TankMoeResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Tanks Marks of Excellence
 * @description The combined-damage thresholds for the 1st, 2nd and 3rd Marks of Excellence on every tank of a region, mirrored per region (marks differ per server). One row per vehicle in the region's catalogue; `moe` is null until the MoE cron has data for the vehicle.
 * @pathParams regionParams
 * @response TankMoeResponse
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
  const results = dataset.map((r) => ({ identity: r.identity, moe: r.moe }));

  return jsonResponse(
    TankMoeResponse,
    { results },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
