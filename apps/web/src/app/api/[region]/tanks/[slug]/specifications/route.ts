import { getTankRow } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { tankSpecRow, tankSpecifications } from "../../categories.api";

export const dynamic = "force-dynamic";

/**
 * Tank specifications
 * @description Combat specifications for one tank on a region: firepower, gun handling, mobility, survivability, concealment and recon. 404 if the region's catalogue has no vehicle with this slug.
 * @pathParams tankParams
 * @response TankSpecRow
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
    tankSpecRow,
    {
      identity: row.identity,
      specifications: row.specs ? tankSpecifications.parse(row.specs) : null,
    },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
