import { getTankRow } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { tankMasteryRow } from "../../categories.api";

export const dynamic = "force-dynamic";

/**
 * Tank Marks of Mastery
 * @description The XP thresholds for the 3rd/2nd/1st Class and Ace Tanker Mastery badges on one tank of a region (mirrored per region). 404 if the region's catalogue has no vehicle with this slug.
 * @pathParams tankParams
 * @response TankMasteryRow
 * @tag Tanks
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const row = await getTankRow(region, decodeURIComponent(slug));
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(
    tankMasteryRow,
    { identity: row.identity, mastery: row.mastery },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
