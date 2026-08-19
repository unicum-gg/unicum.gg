import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { tankSpecifications } from "../categories.api";
import { TankSpecsResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tanks specifications
 * @description Combat specifications for every tank on a region: firepower (damage, DPM, penetration, accuracy, aim time), gun handling and dispersion, mobility (speed, traverse, terrain resistance, power-to-weight), survivability (hit points, armor, module health) and concealment / view range. One row per vehicle in the region's catalogue. Values are region-agnostic (WG balances vehicles identically across servers); only the catalogue differs per region.
 * @pathParams regionParams
 * @response TankSpecsResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/specifications", () => GET__perf(...args));
}
async function GET__perf(
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
    // Project the TankSpec onto the combat columns (strips economics/research).
    specifications: r.specs ? tankSpecifications.parse(r.specs) : null,
  }));

  return jsonResponse(
    TankSpecsResponse,
    { results },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
