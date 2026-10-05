import { isRegion } from "@unicum.gg/wargaming";
import {
  MAX_RECENT_BATTLES,
  RECENT_BATTLES,
  recentBattlesOf,
} from "@unicum.gg/core/battles/read";
import { resolveAccountByNickname } from "@unicum.gg/core/players/resolve-account";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerBattlesResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Player battles
 * @description A player's most recent battles: the map, the mode, the vehicle they brought and what it did, newest first. Wargaming publishes an account's running totals and nothing about a single battle, so every battle here exists only because somebody who was in it runs the unicum.gg mod and shares them. A player's history therefore begins the day someone in their battles started sharing, and an empty list means nobody has, not that they have not played. 404 when the nickname is unknown in this region.
 * @pathParams playerLiveParams
 * @queryParams playerBattlesQuery
 * @response PlayerBattlesResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/battles", () =>
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
  const asked = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(asked) && asked > 0 ? asked : RECENT_BATTLES;

  try {
    const account = await resolveAccountByNickname(region, decoded);
    if (!account) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const battles = await recentBattlesOf(
      region,
      account.accountId,
      Math.min(limit, MAX_RECENT_BATTLES),
    );
    // Short, because the next battle is minutes away and a stale list is the
    // one thing a player checking their own page will notice. Short rather
    // than none, because a page load asks for this alongside everything else
    // and a reader refreshing twice should not cost two index probes.
    return jsonResponse(
      PlayerBattlesResponse,
      {
        accountId: account.accountId,
        // The resolver answers null when it found the account without a name
        // to go with it, which a rename history lookup can. The asked-for name
        // is then the only one there is, and it is the one the reader typed.
        nickname: account.nickname ?? decoded,
        battles: battles.map((battle) => ({
          ...battle,
          startedAt: battle.startedAt.toISOString(),
        })),
      },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/battles] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
