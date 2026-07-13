import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming/region";
import { TankMasteryResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Tanks Marks of Mastery
 * @description The XP thresholds for the 3rd Class, 2nd Class, 1st Class and Ace Tanker Mastery badges on every tank of a region, mirrored per region (thresholds differ per server). One row per vehicle in the region's catalogue; `mastery` is null until the mastery cron has data for the vehicle.
 * @pathParams regionParams
 * @response TankMasteryResponse
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
  const results = dataset.map((r) => ({
    identity: r.identity,
    mastery: r.mastery,
  }));

  return jsonResponse(
    TankMasteryResponse,
    { results },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
