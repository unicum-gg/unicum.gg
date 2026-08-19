import { getPlayerCurrentClanByNickname } from "@unicum.gg/core/players/clan-history";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerClanResponse } from "./schema.api";
import { measured } from "@/services/perf";

// Cached clan read per request; cheap (DB only, no Wargaming), so callers like
// the top-bar login widget can hit it on every page.
export const dynamic = "force-dynamic";

/**
 * Player current clan
 * @description The player's current clan (tag, name, color) from cached data only, with no live Wargaming call. Returns `{ clan: null }` when the player is not in a clan or is not yet tracked. A lightweight companion to the full player detail, meant for compact UI such as nav bars.
 * @pathParams playerLiveParams
 * @response PlayerClanResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/clan", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const clan = await getPlayerCurrentClanByNickname(
    region,
    decodeURIComponent(nickname),
  );
  return jsonResponse(PlayerClanResponse, {
    clan: clan ? { tag: clan.tag, name: clan.name, color: clan.color } : null,
  });
}
