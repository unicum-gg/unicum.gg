import { isRegion } from "@unicum.gg/wargaming";
import { MODE_ECONOMY_WINDOW_DAYS } from "@unicum.gg/shared";
import { playerModeEconomy } from "@unicum.gg/core/battles/player-economy";
import { isBattlesHidden } from "@unicum.gg/core/battles/privacy";
import { resolveAccountByNickname } from "@unicum.gg/core/players/resolve-account";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerModeEconomyResponse } from "./schema.api";
import { measured } from "@/services/perf";
import { isOwner } from "@/services/battles/owner";

/**
 * Player profit by mode
 * @description What each battle mode paid this player at each tier over the last 90 days: credits earned per battle, the repair, ammunition and consumable bills, and what landed in the account, per battle and per minute of battle. Wargaming publishes no credits for anyone, so this is read from the battles the player uploaded themselves through the unicum.gg mod, the only results that carry their own wallet; battles somebody else uploaded are not counted. Empty rows when they have uploaded none. A player who keeps their battle list to themselves keeps this too: it then answers `hidden: true` with no rows to anyone but them, signed in. 404 when the nickname is unknown in this region.
 * @pathParams playerLiveParams
 * @response PlayerModeEconomyResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/battles/economy", () =>
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
  const decoded = decodeURIComponent(nickname);

  try {
    const account = await resolveAccountByNickname(region, decoded);
    if (!account) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const nicknameNow = account.nickname ?? decoded;
    // What each mode paid is read off the battle list, so a private list keeps
    // it private, answered per reader for the list's own reason: neither
    // answer may sit in a shared cache.
    const hidden = await isBattlesHidden(`${region}-${account.accountId}`);
    if (hidden && !(await isOwner(region, account.accountId))) {
      return jsonResponse(
        PlayerModeEconomyResponse,
        {
          accountId: account.accountId,
          nickname: nicknameNow,
          windowDays: MODE_ECONOMY_WINDOW_DAYS,
          rows: [],
          hidden,
        },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    const economy = await playerModeEconomy(region, account.accountId);
    return jsonResponse(
      PlayerModeEconomyResponse,
      { ...economy, nickname: nicknameNow, ...(hidden ? { hidden } : {}) },
      // The encounters' cache: one more battle barely moves a per-battle mean.
      {
        headers: {
          "cache-control": hidden ? "private, no-store" : "public, max-age=300",
        },
      },
    );
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/battles/economy] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
