import { LoadoutMode } from "@unicum.gg/shared";
import { battleOfAccount } from "@unicum.gg/core/battles/read";
import { getTankLoadoutStats } from "@unicum.gg/core/tanks/loadout-aggregate";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { pictureBattleRows } from "@/services/battles/rows";
import { contentLanguage, interfaceLanguage } from "@/services/openapi/locale";
import { measured } from "@/services/perf";
import { TankLoadoutsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Tank loadouts
 * @description What a vehicle's players actually fit to it in battle: equipment, consumables, directives, field modifications, crew skills, the complete setups players run, how much of the rack costs gold, and the best battles with exactly what was fitted for each. Counted from the battles recorded through the unicum.gg mod, one battle mode at a time (random by default, never pooled), over the last 90 days, never from what sits in a garage today: equipment changes with the game, and a setup belongs beside the battle it was fitted for. Wargaming publishes what a tank does and never what anyone put on it, so this is the only source for any of it. Every share is counted in players and comes with the sample it was counted over, and the performance beside a setup is the result of the battles it was fitted in, next to the same players' result in the vehicle over all their counted battles.
 * @pathParams tankParams
 * @queryParams loadoutsQuery
 * @response TankLoadoutsResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/{slug}/loadouts", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const tank = await getTankBySlug(region, decodeURIComponent(slug));
  if (!tank) return Response.json({ error: "not_found" }, { status: 404 });

  // An unknown value falls back to the default rather than 400ing. The param
  // only picks a view, so the worst a bad one can do is answer a neighbouring
  // question, and refusing would break a reader whose only mistake was an
  // edited URL.
  const asked = new URL(req.url).searchParams.get("mode");
  const mode = Object.values(LoadoutMode).includes(asked as LoadoutMode)
    ? (asked as LoadoutMode)
    : LoadoutMode.Random;

  const stats = await getTankLoadoutStats(region, tank.tankId, mode);

  // The best battles are drawn as a player's own Battles tab draws them: read
  // through the same reader, as seen by the player who fought them, and
  // pictured by the same service. A battle that vanished between the two reads
  // is dropped rather than drawn half.
  const served = interfaceLanguage(req);
  const found = await Promise.all(
    stats.topBattles.map((top) =>
      battleOfAccount(region, top.accountId, top.arenaUniqueId, top.startedAt),
    ),
  );
  const kept = stats.topBattles.flatMap((top, index) =>
    found[index] ? [{ top, battle: found[index]! }] : [],
  );
  const pictured = await pictureBattleRows(
    region,
    kept.map((entry) => entry.battle),
    served,
  );
  const topBattles = kept.map(({ top }, index) => ({
    player: {
      nickname: top.nickname,
      accountId: top.accountId,
      clanTag: top.clanTag,
      clanColor: top.clanColor,
      isVerified: top.isVerified,
      isSupporter: top.isSupporter,
      twitchLogin: top.twitchLogin,
      tournamentWins: top.tournamentWins,
      tournamentFeaturedWins: top.tournamentFeaturedWins,
      tournamentBestTitle: top.tournamentBestTitle,
      onslaughtBestTier: top.onslaughtBestTier,
      onslaughtBestRank: top.onslaughtBestRank,
      onslaughtSeasons: top.onslaughtSeasons,
    },
    battle: pictured[index]!,
  }));

  return jsonResponse(TankLoadoutsResponse, { ...stats, topBattles }, contentLanguage(served, {
    headers: {
      // A battle lands when a player's client next uploads, which is minutes to
      // hours, and nothing on this page is watching for its own write to appear
      // (unlike the videos queue). So a shared cache may hold it for a while,
      // and the browser is left to revalidate.
      "cache-control":
        "public, max-age=0, s-maxage=900, stale-while-revalidate=300",
    },
  }));
}
