import { listTankRatingBoard } from "@unicum.gg/core/tanks/ratings-board";
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { TankRatingBoardResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Community ratings board
 * @description Every vehicle players have rated, with what they think of it and how far that is from what it actually does. `overallBayes` is the mean shrunk towards the site-wide average and is what the board sorts on, so a tank three people liked cannot sit above one four hundred have judged. `hype` is the community's rank inside the tier minus the tank's measured win-rate rank inside the same tier: sort it descending for the most overrated vehicles in the game, ascending for the most underrated. Vehicles nobody has rated are absent rather than returned with nulls, so an unrated tank is never read as a badly rated one. The votes are global, the identities are the region's catalogue.
 * @pathParams regionParams
 * @response TankRatingBoardResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/ratings", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const [board, tanks] = await Promise.all([
    listTankRatingBoard(),
    listTanks(region),
  ]);
  const byId = new Map(tanks.map((t) => [t.tankId, t]));

  // A rated vehicle this region does not ship is dropped rather than returned
  // nameless: the row exists to send a reader to that tank's page, and there is
  // no such page here. The votes stay counted in `totalVotes`, which is a fact
  // about the site rather than about this catalogue.
  const results = board.rows.flatMap((row) => {
    const tank = byId.get(row.tankId);
    if (!tank) return [];
    return [
      {
        identity: { tankId: tank.tankId, slug: tank.slug, ...tank.meta },
        votes: row.votes,
        reviews: row.reviews,
        overall: row.overall,
        fun: row.fun,
        overallBayes: row.overallBayes,
        funBayes: row.funBayes,
        overallStddev: row.overallStddev,
        perceivedPercentile: row.perceivedPercentile,
        measuredPercentile: row.measuredPercentile,
        hype: row.hype,
      },
    ];
  });

  return jsonResponse(
    TankRatingBoardResponse,
    {
      results,
      totalVotes: board.totalVotes,
      ratedTanks: results.length,
      computedAt: board.computedAt,
    },
    {
      // The rollup behind it moves once an hour, so a ten-minute shared cache
      // costs nothing in freshness and takes the whole board off the database.
      headers: { "cache-control": "public, max-age=60, s-maxage=600" },
    },
  );
}
