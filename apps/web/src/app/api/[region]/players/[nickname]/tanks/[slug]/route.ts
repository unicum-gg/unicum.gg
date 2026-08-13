import { getPlayerTankDetail } from "@unicum.gg/core/players/tank-detail";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerTankDetailResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Player vehicle record
 * @description One player's record on one vehicle, in the shape of the game's own Service Record: the general parameters (win rate, survival, hit rate, damage and destruction ratios, armour use) and the per-battle averages, plus the WN7/WN8/WNX the player earned on that tank and their marks. Reads the newest stored snapshot for the pair, so every number carries the same `updated_at`. 404 when we do not track the player, the slug is not a vehicle, or the player has never played it.
 * @pathParams playerTankParams
 * @response PlayerTankDetailResponse
 * @tag Players
 * @openapi
 */
export async function GET(
  _req: Request,
  {
    params,
  }: { params: Promise<{ region: string; nickname: string; slug: string }> },
) {
  const { region, nickname, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);

  try {
    const detail = await getPlayerTankDetail(region, decoded, slug);
    if (!detail) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return jsonResponse(PlayerTankDetailResponse, detail);
  } catch (err) {
    console.error(
      `[api/${region}/players/${decoded}/tanks/${slug}] failed:`,
      err,
    );
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
