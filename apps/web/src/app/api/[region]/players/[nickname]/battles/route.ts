import { isRegion } from "@unicum.gg/wargaming";
import {
  MAX_RECENT_BATTLES,
  RECENT_BATTLES,
  countPlayerBattles,
  recentBattlesOf,
} from "@unicum.gg/core/battles/read";
import { resolveAccountByNickname } from "@unicum.gg/core/players/resolve-account";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerBattlesResponse } from "./schema.api";
import { contentLanguage, interfaceLanguage } from "@/services/openapi/locale";
import { pictureBattleRows } from "@/services/battles/rows";
import { measured } from "@/services/perf";
import {
  playerBattleFacets,
  type PlayerBattleFilter,
} from "@unicum.gg/core/battles/filters";
import { BattleResultFilter } from "@unicum.gg/shared";

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
  const query = new URL(req.url).searchParams;
  const asked = Number(query.get("limit"));
  const limit = Math.min(
    Number.isFinite(asked) && asked > 0 ? Math.trunc(asked) : RECENT_BATTLES,
    MAX_RECENT_BATTLES,
  );
  const askedPage = Number(query.get("page"));
  const page = Number.isInteger(askedPage) && askedPage > 0 ? askedPage : 1;
  const filter = battleFilterFrom(query);

  try {
    const account = await resolveAccountByNickname(region, decoded);
    if (!account) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const [battles, total, facets] = await Promise.all([
      recentBattlesOf(
        region,
        account.accountId,
        limit,
        (page - 1) * limit,
        filter,
      ),
      countPlayerBattles(region, account.accountId, filter),
      // Only for a page that draws the filters: the overview's ten battles
      // have no use for them and are read on every profile view.
      query.get("facets") === "true"
        ? playerBattleFacets(region, account.accountId)
        : Promise.resolve(undefined),
    ]);
    const served = interfaceLanguage(req);
    const pictured = await pictureBattleRows(region, battles, served);

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
        total,
        ...(facets ? { facets } : {}),
        // `devices` is pulled OUT of the spread rather than written over it:
        // the database layer hands back catalogue KEYS under that name and
        // this answer carries PICTURES, so spreading first would put both
        // shapes in the type and neither reader would know which it had.
        battles: pictured,
      },
      contentLanguage(served, {
        headers: { "cache-control": "public, max-age=60" },
      }),
    );
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/battles] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}

/**
 * The filters a request names, each dropped rather than rejected when it does
 * not parse: a filter that reads as nothing gives the whole list, which is
 * what a hand-edited URL with a typo in it should get.
 */
function battleFilterFrom(query: URLSearchParams): PlayerBattleFilter {
  const filter: PlayerBattleFilter = {};
  const mode = Number(query.get("mode"));
  if (query.get("mode") && Number.isInteger(mode)) filter.battleType = mode;
  const tank = Number(query.get("tank"));
  if (query.get("tank") && Number.isInteger(tank)) filter.tank = tank;
  const map = query.get("map");
  if (map) filter.map = map;
  const result = query.get("result");
  if (Object.values(BattleResultFilter).includes(result as BattleResultFilter)) {
    filter.result = result as BattleResultFilter;
  }
  return filter;
}
