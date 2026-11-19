import { isRegion } from "@unicum.gg/wargaming";
import {
  BattleCatalogSort,
  DEFAULT_BATTLE_CATALOG_SORT,
  LATEST_BATTLE_VERSION,
} from "@unicum.gg/shared";
import { battleOfAccount } from "@unicum.gg/core/battles/read";
import {
  catalogBattles,
  catalogFacets,
  catalogVersions,
  countCatalogBattles,
} from "@unicum.gg/core/battles/catalog";
import { jsonResponse } from "@/services/openapi/json-response";
import { pictureBattleRows } from "@/services/battles/rows";
import { battleFilterFrom } from "@/services/battles/filter";
import { contentLanguage, interfaceLanguage } from "@/services/openapi/locale";
import { measured } from "@/services/perf";
import PAGINATION from "@/constants/pagination";
import { BattlesCatalogResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/** The most battles one page may ask for. */
const MAX_LIMIT = 100;

/**
 * Battles and replays
 * @description Every battle whose `.wotreplay` file was archived, whether the unicum.gg mod sent it or a player uploaded it on the site, each drawn from the player who recorded it, which is the one point of view a replay holds: the map, the mode, their vehicle, what they did and what they had fitted, and a 2D replay on the battle's own page. Ranked by the recorder's damage by default, or their assisted damage, experience or kills, or by date (`recent`). Filtered by mode, map and game update on the battle, and by vehicle and result on the recorder (`version=latest` for the newest update the catalogue holds). A recorder who keeps their battle list private is left out, with their replays.
 * @pathParams regionParams
 * @queryParams battlesCatalogQuery
 * @response BattlesCatalogResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/battles", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const query = new URL(req.url).searchParams;
  const askedLimit = Number(query.get("limit"));
  const limit = Math.min(
    Number.isInteger(askedLimit) && askedLimit > 0
      ? askedLimit
      : PAGINATION.SIZE.FEED,
    MAX_LIMIT,
  );
  const askedPage = Number(query.get("page"));
  const page = Number.isInteger(askedPage) && askedPage > 0 ? askedPage : 1;
  // An unknown sort reads as the default rather than a 400: it only picks an
  // order, like the filters beside it.
  const askedSort = query.get("sort");
  const sort = Object.values(BattleCatalogSort).includes(askedSort as BattleCatalogSort)
    ? (askedSort as BattleCatalogSort)
    : DEFAULT_BATTLE_CATALOG_SORT;
  const filter = battleFilterFrom(query);
  // Read whenever they are shown or `latest` has to be resolved against them:
  // one grouped count over the catalogue.
  const wantsFacets = query.get("facets") === "true";
  const versions =
    wantsFacets || query.get("version") === LATEST_BATTLE_VERSION
      ? await catalogVersions(region)
      : undefined;
  if (query.get("version") === LATEST_BATTLE_VERSION && versions?.[0]) {
    filter.version = versions[0].value;
  }

  const [entries, total, facets] = await Promise.all([
    catalogBattles(region, filter, sort, limit, (page - 1) * limit),
    countCatalogBattles(region, filter),
    wantsFacets ? catalogFacets(region) : Promise.resolve(undefined),
  ]);

  // Drawn as a player's own Battles tab draws them, through the same reader and
  // the same picturing service, like the vehicle and map pages' best battles. A
  // battle that vanished between the two reads is dropped rather than drawn half.
  const found = await Promise.all(
    entries.map((entry) =>
      battleOfAccount(region, entry.accountId, entry.arenaUniqueId, entry.startedAt),
    ),
  );
  const kept = entries.flatMap((entry, index) =>
    found[index] ? [{ entry, battle: found[index]! }] : [],
  );
  const served = interfaceLanguage(req);
  const pictured = await pictureBattleRows(
    region,
    kept.map((each) => each.battle),
    served,
  );
  const battles = kept.map(({ entry }, index) => ({
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
    stats: { views: entry.views ?? 0, downloads: entry.downloads ?? 0 },
    battle: pictured[index]!,
  }));

  return jsonResponse(
    BattlesCatalogResponse,
    {
      battles,
      total,
      version: filter.version ?? null,
      ...(facets ? { facets } : {}),
      ...(wantsFacets && versions ? { versions } : {}),
    },
    contentLanguage(served, {
      headers: {
        // A replay lands whenever a client uploads one, and a reader refreshing
        // the catalogue twice should not cost two scans of it.
        "cache-control":
          "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
      },
    }),
  );
}
