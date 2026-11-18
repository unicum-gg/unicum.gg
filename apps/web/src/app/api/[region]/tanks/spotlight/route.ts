import { getTankSpotlight } from "@unicum.gg/core/wargaming/wot/tanks/spotlight";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { TankSpotlightResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * New and upcoming tanks
 * @description The eight newest vehicles: the ones only the Common Test client carries first, then the releases of each update, newest update first and best tier first within one, topped up from the previous update when the latest added fewer than eight. Event vehicles, event bots and mode reissues (the Onslaught 7x7 editions, Frontline and cybercafe copies) are left out, since they are another tank handed out again rather than a new one.
 * @pathParams regionParams
 * @response TankSpotlightResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/spotlight", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const tanks = await getTankSpotlight(region);
  return jsonResponse(TankSpotlightResponse, { tanks }, {
    headers: { "cache-control": "public, max-age=600" },
  });
}
