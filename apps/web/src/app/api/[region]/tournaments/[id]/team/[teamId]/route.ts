import { isRegion } from "@unicum.gg/wargaming";
import { getTeamRoster } from "@unicum.gg/core/tournaments/read";
import { jsonResponse } from "@/services/openapi/json-response";
import { TournamentTeamRosterResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tournament team
 * @description One team's roster, joined onto the accounts behind it: lifetime battles, win rate and ratings per player, plus the clan each one is in now. This is what turns a tournament roster from a list of names into something you can scout. 404 when the team is unknown on this tournament.
 * @pathParams tournamentTeamParams
 * @response TournamentTeamRosterResponse
 * @tag Tournaments
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tournaments/{id}/team/{teamId}", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; id: string; teamId: string }> },
) {
  const { region, id, teamId } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const tournamentId = Number(id);
  const team = Number(teamId);
  if (
    !Number.isSafeInteger(tournamentId) ||
    tournamentId <= 0 ||
    !Number.isSafeInteger(team) ||
    team <= 0
  ) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const data = await getTeamRoster(region, tournamentId, team);
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(TournamentTeamRosterResponse, data, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
