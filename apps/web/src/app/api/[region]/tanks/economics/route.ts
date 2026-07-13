import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming/region";
import { tankEconomics } from "../categories.api";
import { TankEconomicsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Tanks economics
 * @description Economics for every tank on a region: purchase price in credits and gold, shell and ammunition cost, the research XP to unlock it from its direct parent, and the total free XP to reach it from a tier 1. One row per vehicle in the region's catalogue. Values are region-agnostic; only the catalogue differs per region.
 * @pathParams regionParams
 * @response TankEconomicsResponse
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
    // Project the TankSpec onto the economics columns.
    economics: r.specs ? tankEconomics.parse(r.specs) : null,
  }));

  return jsonResponse(
    TankEconomicsResponse,
    { results },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
