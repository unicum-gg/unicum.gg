import { loadClanDetailByTag } from "@/services/clans/detail";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanActivityResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Clan activity
 * @description Recent join / leave / role-change events for the clan. 404 if the region's clan with this tag doesn't exist.
 * @pathParams clanLiveParams
 * @response ClanActivityResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/activity", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  const { region, tag } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const detail = await loadClanDetailByTag(region, decodeURIComponent(tag));
  if (!detail) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(ClanActivityResponse, { events: detail.events });
}
