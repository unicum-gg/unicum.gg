import { getTankRow } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { tankEconRow, tankEconomics } from "../../categories.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tank economics
 * @description Economics for one tank on a region: purchase price (credits / gold), shell and ammo cost, research XP from its direct parent, and total free XP to reach it from a tier 1. 404 if the region's catalogue has no vehicle with this slug.
 * @pathParams tankParams
 * @response TankEconRow
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/{slug}/economics", () => GET__perf(...args));
}
async function GET__perf(
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
    tankEconRow,
    {
      identity: row.identity,
      economics: row.specs ? tankEconomics.parse(row.specs) : null,
    },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
