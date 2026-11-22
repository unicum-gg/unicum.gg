import { isRegion } from "@unicum.gg/wargaming";
import { getPlayerSkirmishTiers } from "@unicum.gg/core/players/skirmish-tiers";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { PlayerSkirmishResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Player Skirmishes by tier
 * @description This player's Skirmishes split by tier (VI, VIII, X, XI), which Wargaming publishes for clans and not for players. Rebuilt from the player's per-vehicle Skirmish records, since a skirmish is fought with vehicles of its own tier; it adds up to the account's Skirmish total. Battles on vehicles of any other tier, from the years when a skirmish capped the tier instead of fixing it, land in one entry with a null tier. Each tier carries its lifetime totals and what it gained over the last 24 hours, 7 days and 30 days. 404 when the nickname is unknown in this region.
 * @pathParams playerLiveParams
 * @response PlayerSkirmishResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/skirmish", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const data = await getPlayerSkirmishTiers(region, decodeURIComponent(nickname));
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(PlayerSkirmishResponse, data, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
