import { listMapRatingBoard } from "@unicum.gg/core/maps/ratings-board";
import { listMapSummaries } from "@unicum.gg/core/wargaming/wot/maps";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { MapRatingBoardResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Map community ratings board
 * @description Every map players have rated, with what they think of it. `overallBayes` is the mean shrunk towards the average of every map vote and is what the board sorts on, so a map three people liked cannot sit above one four hundred have judged. The prior is taken over the map votes alone rather than over every community vote on the site, because the two populations sit at different heights: people are far harder on the ground they are sent to than on the vehicles they chose to buy. Maps nobody has rated are absent rather than returned with nulls, so an unrated map is never read as a badly rated one. There is no over/underrated column here, unlike the vehicle board: it compares a reputation to a measured win rate, and no per-arena win rate exists anywhere. The votes are global, the identities are the region's catalogue.
 * @pathParams regionParams
 * @response MapRatingBoardResponse
 * @tag Maps
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maps/ratings", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const [board, maps] = await Promise.all([
    listMapRatingBoard(),
    listMapSummaries(region),
  ]);

  // Indexed by the base arena id, which is the only id a vote ever carries. A
  // map's variants (the Waffenträger reskins, the Onslaught night versions) are
  // views of it rather than maps beside it, and they share its page, so they
  // share its verdict: the panel asks what players make of this map, and the
  // page is the map.
  const byArena = new Map(maps.map((m) => [m.arenaId, m]));

  // A rated arena this region's catalogue does not carry is dropped rather than
  // returned nameless: the row exists to send a reader to that map's page, and
  // there is no such page here. The votes stay counted in `totalVotes`, which
  // is a fact about the site rather than about this catalogue.
  const results = board.rows.flatMap((row) => {
    const map = byArena.get(row.arenaId);
    if (!map) return [];
    return [
      {
        identity: {
          arenaId: row.arenaId,
          slug: map.slug,
          name: map.name,
          camouflage: map.camouflage,
          sizeMeters: map.sizeMeters,
          minimapUrl: map.minimapUrl,
          commonTest: map.commonTest,
        },
        votes: row.votes,
        reviews: row.reviews,
        overall: row.overall,
        fun: row.fun,
        overallBayes: row.overallBayes,
        funBayes: row.funBayes,
        overallStddev: row.overallStddev,
      },
    ];
  });

  return jsonResponse(
    MapRatingBoardResponse,
    {
      results,
      totalVotes: board.totalVotes,
      ratedMaps: results.length,
      computedAt: board.computedAt,
    },
    {
      // The rollup behind it moves once an hour, so a ten-minute shared cache
      // costs nothing in freshness and takes the whole board off the database.
      headers: { "cache-control": "public, max-age=60, s-maxage=600" },
    },
  );
}
