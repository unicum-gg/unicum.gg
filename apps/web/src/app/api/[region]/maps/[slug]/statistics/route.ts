import { LoadoutMode } from "@unicum.gg/shared";
import { battleOfAccount } from "@unicum.gg/core/battles/read";
import { getMapStatistics } from "@unicum.gg/core/maps/statistics";
import { topMapBattles } from "@unicum.gg/core/maps/statistics-top-battles";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { pictureBattleRows } from "@/services/battles/rows";
import { contentLanguage, interfaceLanguage } from "@/services/openapi/locale";
import { measured } from "@/services/perf";
import { MapStatisticsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Map statistics
 * @description What the battles recorded on a map say about it, one battle mode at a time (random by default, never pooled), over the last 90 days: how long a battle lasts, how it ends, which spawn wins, how each vehicle class, each tier and each vehicle does there against the same vehicles on every other map, and the best battles fought on it. Counted from the battles uploaded through the unicum.gg mod, each of which carries all thirty vehicles in it, bots excluded. Wargaming publishes no per-map record for anyone, so this is the only source for any of it. Battles and vehicle records are two different units and each block states its own sample: the spawn balance needs far more battles before it says anything than the class rows do. 404 when the slug maps to no map on the region.
 * @pathParams mapParams
 * @queryParams mapStatisticsQuery
 * @response MapStatisticsResponse
 * @tag Maps
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maps/{slug}/statistics", () =>
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
  const map = await getMapDetailBySlug(region, decodeURIComponent(slug));
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });

  // An unknown value falls back to the default rather than 400ing, as on the
  // vehicle loadouts: the param only picks a view.
  const asked = new URL(req.url).searchParams.get("mode");
  const mode = Object.values(LoadoutMode).includes(asked as LoadoutMode)
    ? (asked as LoadoutMode)
    : LoadoutMode.Random;

  // The map and every variant folded into it, which share its page.
  const arenas = [map.arenaId, ...map.variants.map((variant) => variant.arenaId)];
  const [stats, top] = await Promise.all([
    getMapStatistics(region, map.arenaId, arenas, mode),
    topMapBattles(region, arenas, mode),
  ]);

  // Drawn as a player's own Battles tab draws them, through the same reader
  // and the same picturing service. A battle that vanished between the two
  // reads is dropped rather than drawn half.
  const served = interfaceLanguage(req);
  const found = await Promise.all(
    top.map((entry) =>
      battleOfAccount(region, entry.accountId, entry.arenaUniqueId, entry.startedAt),
    ),
  );
  const kept = top.flatMap((entry, index) =>
    found[index] ? [{ entry, battle: found[index]! }] : [],
  );
  const pictured = await pictureBattleRows(
    region,
    kept.map((each) => each.battle),
    served,
  );
  const topBattles = kept.map(({ entry }, index) => ({
    player: {
      nickname: entry.nickname,
      accountId: entry.accountId,
      clanTag: entry.clanTag,
      clanColor: entry.clanColor,
      isVerified: entry.isVerified,
      isSupporter: entry.isSupporter,
      twitchLogin: entry.twitchLogin,
      tournamentWins: entry.tournamentWins,
      tournamentFeaturedWins: entry.tournamentFeaturedWins,
      tournamentBestTitle: entry.tournamentBestTitle,
      onslaughtBestTier: entry.onslaughtBestTier,
      onslaughtBestRank: entry.onslaughtBestRank,
      onslaughtSeasons: entry.onslaughtSeasons,
    },
    battle: pictured[index]!,
  }));

  return jsonResponse(
    MapStatisticsResponse,
    { ...stats, topBattles },
    contentLanguage(served, {
      headers: {
        // A battle lands when a player's client next uploads, and nothing on
        // the page watches for its own write, so a shared cache may hold this.
        "cache-control":
          "public, max-age=0, s-maxage=900, stale-while-revalidate=300",
      },
    }),
  );
}
