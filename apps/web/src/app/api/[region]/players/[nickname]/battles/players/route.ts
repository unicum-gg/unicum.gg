import { isRegion } from "@unicum.gg/wargaming";
import { playerBattleEncounters } from "@unicum.gg/core/battles/met";
import { resolveAccountByNickname } from "@unicum.gg/core/players/resolve-account";
import { attachPlayerCrests } from "@/services/players/attach-badges";
import { battleFilterFrom } from "@/services/battles/filter";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerBattleEncountersResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Players met in battle
 * @description Who this player keeps meeting in the battles we hold: the players most often on their team and the ones most often across from them, each with the battles shared, the wins and the last time. Counted over the battles shared through the unicum.gg mod, so it covers those and nothing else, and takes the battles list's own filters. Somebody met once is not listed. 404 when the nickname is unknown in this region.
 * @pathParams playerLiveParams
 * @queryParams playerBattleEncountersQuery
 * @response PlayerBattleEncountersResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/battles/players", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);
  const filter = battleFilterFrom(new URL(req.url).searchParams);

  try {
    const account = await resolveAccountByNickname(region, decoded);
    if (!account) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const { allies, opponents } = await playerBattleEncounters(
      region,
      account.accountId,
      filter,
    );
    // The auth-backed crests, attached here like on every other list of
    // players. One lookup for both sides.
    const crested = await attachPlayerCrests(region, [...allies, ...opponents]);
    return jsonResponse(
      PlayerBattleEncountersResponse,
      {
        accountId: account.accountId,
        nickname: account.nickname ?? decoded,
        allies: crested.slice(0, allies.length),
        opponents: crested.slice(allies.length),
      },
      // Longer than the battles list: one new battle barely moves a count of
      // battles shared, and this walks every battle the account has.
      { headers: { "cache-control": "public, max-age=300" } },
    );
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/battles/players] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
