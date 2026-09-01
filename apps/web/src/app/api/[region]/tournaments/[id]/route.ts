import { isRegion } from "@unicum.gg/wargaming";
import { getTournament } from "@unicum.gg/core/tournaments/read";
import { jsonResponse } from "@/services/openapi/json-response";
import { TournamentDetailResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tournament
 * @description One tournament in full: its rules and prize breakdown, its map pool with each map's per-side spawns, every registered team with its roster of account ids, and the whole bracket with per-match scores, maps and placements. 404 when the id is unknown on this region.
 * @pathParams tournamentParams
 * @response TournamentDetailResponse
 * @tag Tournaments
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tournaments/{id}", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const tournamentId = Number(id);
  if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const data = await getTournament(region, tournamentId);
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(TournamentDetailResponse, data, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
