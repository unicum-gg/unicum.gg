import { loadModeEconomy } from "@unicum.gg/core/battles/mode-economy";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { ModeEconomyResponse } from "./schema.api";

/**
 * Credits and experience by battle mode
 * @description What each battle mode pays at each tier over the last 90 days: credits and experience per battle and per minute of battle, battle length, and, for the mod's own players, what landed in the account once repairs, ammunition and consumables were paid. Wargaming publishes no credits per mode for anyone, so every figure is counted from the battles uploaded through the unicum.gg mod, each of which carries the battle's own credits for all thirty participants. Rebuilt hourly. 404 until the first run. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @response ModeEconomyResponse
 * @tag Server
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/modes/economy", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const economy = await loadModeEconomy(region);
  // No rows yet: the hourly pass has not run for this region since the table
  // was added. A 404, so the page leaves the panel out rather than drawing an
  // empty one.
  if (!economy) {
    return Response.json({ error: "not_computed" }, { status: 404 });
  }
  return jsonResponse(ModeEconomyResponse, economy);
}
