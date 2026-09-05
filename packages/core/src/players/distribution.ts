import { sql } from "drizzle-orm";
import {
  bucketEdges,
  DISTRIBUTION_MIN_BATTLES,
  type DistributionBucket,
  type PlayerDistribution,
  playerDistributionByRegion,
  playersByRegion,
  type TierShare,
  tankStatsByRegion,
  type TypeShare,
  vehiclesByRegion,
  RATING_DOMAIN,
  RATING_RANGES,
  type RatingDistributions,
  RATING_METRICS,
  RatingMetric,
  WINRATE_DOMAIN,
  WINRATE_RANGE,
} from "@unicum.gg/shared";
import { REGIONS, type Region, type VehicleType } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";

/**
 * How the region's players are spread across win rate and WNX, and how its
 * battles are spread across tiers and vehicle types.
 *
 * The two histograms come off `*_players` rather than the snapshots: the win
 * rate, WNX and battle count are denormalised onto the player row, so the whole
 * population is one sequential scan (~380ms on EU's 2.1M rows) instead of a
 * pass over the 13M-row snapshot table. The tier and type breakdowns come off
 * `*_tank_stats`, the ~1000-row per-tank aggregate the nightly cron already
 * maintains, joined to the vehicle catalogue for the tier and the class. The
 * 360-million-row `*_tank_snapshots` is never touched, which is what keeps any
 * of this affordable.
 */

// Hourly at :45, away from the coverage trends (:15) and the tank ratings
// (:30), so the three scans never land on the same minute.
const SCHEDULE = "45 * * * *";

/** `*_tank_stats.winrate` is a percentage while `*_players.winrate` is a
 * fraction. The payload is fractions throughout, so the per-tank side is
 * divided here rather than leaving two scales in one response. */
const PERCENT = 100;

/**
 * Application-level single-flight, per region.
 *
 * The `cron_leader` lease and `scheduleCron`'s in-flight guard stop a second
 * TICK, but neither can stop the boot seed (`runInitialIfEmpty`) from racing the
 * first scheduled tick for the same region inside one process, since both call
 * the recompute directly. Without this, a worker booting a minute before :45
 * runs two full scans of the player table concurrently and then has both
 * transactions delete and re-insert the same singleton row. The coverage trends
 * beside this file document the same race and guard it the same way.
 */
const inFlight = new Map<Region, Promise<void>>();

type BucketRow = { metric: string; bucket: number; n: number };
type ShareRow = { key: string; tanks: number; battles: number; winrate: number };

/**
 * Fill a bucket series from the rows `width_bucket` produced.
 *
 * `width_bucket` answers 0 for a value below the range and `steps + 1` for one
 * above, which is exactly the two overflow buckets `bucketEdges` describes, so
 * the index it returns is the index into that array.
 */
function toBuckets(
  rows: BucketRow[],
  metric: string,
  range: { min: number; max: number; steps: number },
  domain: { min: number; max: number },
): DistributionBucket[] {
  const edges = bucketEdges(range, domain);
  const counts = new Map(
    rows.filter((r) => r.metric === metric).map((r) => [r.bucket, r.n]),
  );
  const filled = edges.map((edge, i) => ({ ...edge, count: counts.get(i) ?? 0 }));

  // Trim an overflow bucket that caught nothing, at either end, once. Win rate
  // has players under 30% and ratings have players above 3000, so those
  // buckets earn their column; nobody is below a rating of zero, and drawing
  // "below 0" as an empty column would invent a region of the scale. Only the
  // two ends are considered, so an empty bucket inside the range keeps its slot
  // and the axis stays evenly spaced. Trimmed after the counts are placed, so
  // the index stays aligned with `width_bucket` while it matters.
  if (filled.length > 0 && filled[0].count === 0) filled.shift();
  if (filled.length > 0 && filled[filled.length - 1].count === 0) filled.pop();
  return filled;
}

/**
 * Every histogram in one pass over one population.
 *
 * The sample requires all four values, so `players` is a single honest
 * denominator: the win-rate histogram and each rating histogram describe the
 * very same accounts, which is what lets one "against N accounts" line sit
 * under all of them. Giving each branch its own NULL guard would be more
 * permissive and less true, since the percentile a player reads would then be
 * measured against a population that differs per metric. Costs nothing today
 * either way (no EU account with a win rate is missing a rating).
 * `MATERIALIZED` is load-bearing: without it the
 * planner inlines the CTE into each branch of the union and scans the player
 * table twice for an answer that only needs reading it once. */
async function readHistograms(region: Region): Promise<BucketRow[]> {
  const t = playersByRegion[region];
  return db.execute<BucketRow>(
    sql`WITH sample AS MATERIALIZED (
          SELECT winrate, wn7, wn8, wnx
          FROM ${t}
          WHERE battles >= ${DISTRIBUTION_MIN_BATTLES}
            AND winrate IS NOT NULL
            AND wn7 IS NOT NULL
            AND wn8 IS NOT NULL
            AND wnx IS NOT NULL
        )
        SELECT 'winrate' AS metric,
               width_bucket(winrate, ${WINRATE_RANGE.min}, ${WINRATE_RANGE.max}, ${WINRATE_RANGE.steps})::int AS bucket,
               count(*)::int AS n
        FROM sample GROUP BY 2
        UNION ALL
        SELECT 'wn7',
               width_bucket(wn7, ${RATING_RANGES[RatingMetric.Wn7].min}, ${RATING_RANGES[RatingMetric.Wn7].max}, ${RATING_RANGES[RatingMetric.Wn7].steps})::int,
               count(*)::int
        FROM sample GROUP BY 2
        UNION ALL
        SELECT 'wn8',
               width_bucket(wn8, ${RATING_RANGES[RatingMetric.Wn8].min}, ${RATING_RANGES[RatingMetric.Wn8].max}, ${RATING_RANGES[RatingMetric.Wn8].steps})::int,
               count(*)::int
        FROM sample GROUP BY 2
        UNION ALL
        SELECT 'wnx',
               width_bucket(wnx, ${RATING_RANGES[RatingMetric.Wnx].min}, ${RATING_RANGES[RatingMetric.Wnx].max}, ${RATING_RANGES[RatingMetric.Wnx].steps})::int,
               count(*)::int
        FROM sample GROUP BY 2`,
  );
}

/**
 * Battles and battle-weighted win rate per tier or per vehicle type.
 *
 * Weighted by battles rather than averaged over tanks, because a tier is not
 * the mean of its vehicles: tier VIII holds 250 of them and six billion
 * battles, and the ones nobody plays must not count as much as the ones
 * everybody does.
 */
async function readShares(
  region: Region,
  column: "tier" | "type",
): Promise<ShareRow[]> {
  const stats = tankStatsByRegion[region];
  const vehicles = vehiclesByRegion[region];
  const key = column === "tier" ? sql`v.tier::text` : sql`v.type`;
  return db.execute<ShareRow>(
    sql`SELECT ${key} AS key,
               count(*)::int AS tanks,
               sum(s.total_battles)::double precision AS battles,
               (sum(s.winrate * s.total_battles)
                 / NULLIF(sum(s.total_battles), 0)
                 / ${PERCENT})::double precision AS winrate
        FROM ${stats} s
        JOIN ${vehicles} v ON v.tank_id = s.tank_id
        WHERE s.total_battles IS NOT NULL AND s.total_battles > 0
        GROUP BY 1
        ORDER BY 1`,
  );
}

/** Recompute one region and replace its singleton row. Coalesced per region, so
 * the boot seed and the first tick share one pass rather than racing. */
export function recomputePlayerDistribution(region: Region): Promise<void> {
  const existing = inFlight.get(region);
  if (existing) return existing;
  const p = recomputeNow(region).finally(() => inFlight.delete(region));
  inFlight.set(region, p);
  return p;
}

async function recomputeNow(region: Region): Promise<void> {
  const [histograms, tiers, types] = await Promise.all([
    readHistograms(region),
    readShares(region, "tier"),
    readShares(region, "type"),
  ]);

  const winrate = toBuckets(
    histograms,
    "winrate",
    WINRATE_RANGE,
    WINRATE_DOMAIN,
  );
  const ratings = Object.fromEntries(
    RATING_METRICS.map((metric) => [
      metric,
      toBuckets(histograms, metric, RATING_RANGES[metric], RATING_DOMAIN),
    ]),
  ) as RatingDistributions;
  const players = winrate.reduce((sum, b) => sum + b.count, 0);

  const byTier: TierShare[] = tiers
    .map((r) => ({
      tier: Number(r.key),
      tanks: r.tanks,
      battles: r.battles,
      winrate: r.winrate ?? 0,
    }))
    .sort((a, b) => a.tier - b.tier);

  const byType: TypeShare[] = types.map((r) => ({
    type: r.key as VehicleType,
    tanks: r.tanks,
    battles: r.battles,
    winrate: r.winrate ?? 0,
  }));

  const target = playerDistributionByRegion[region];
  await db.transaction(async (tx) => {
    await tx.delete(target);
    await tx.insert(target).values({
      id: 1,
      minBattles: DISTRIBUTION_MIN_BATTLES,
      players,
      winrate,
      wn7: ratings[RatingMetric.Wn7],
      wn8: ratings[RatingMetric.Wn8],
      wnx: ratings[RatingMetric.Wnx],
      byTier,
      byType,
    });
  });
}

/** Read one region's stored distribution. Null before the first run. */
export async function loadPlayerDistribution(
  region: Region,
): Promise<PlayerDistribution | null> {
  const table = playerDistributionByRegion[region];
  const rows = await db.select().from(table).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    region,
    minBattles: row.minBattles,
    players: row.players,
    winrate: row.winrate,
    ratings: {
      [RatingMetric.Wn7]: row.wn7,
      [RatingMetric.Wn8]: row.wn8,
      [RatingMetric.Wnx]: row.wnx,
    },
    byTier: row.byTier,
    byType: row.byType,
    computedAt: row.computedAt,
  };
}

/**
 * Recompute every region SEQUENTIALLY, like the coverage trends: the point of
 * moving these scans off the request path is not to have three of them stack on
 * the shared pool instead. One region's failure is logged, not fatal.
 */
export async function refreshPlayerDistributions(): Promise<number> {
  let ok = 0;
  for (const region of REGIONS) {
    try {
      const start = Date.now();
      await recomputePlayerDistribution(region);
      ok++;
      console.log(
        `[player-distribution-cron] ${region} recomputed in ${Date.now() - start}ms`,
      );
    } catch (err) {
      console.error(`[player-distribution-cron] ${region} failed:`, err);
    }
  }
  return ok;
}

// Seed on boot so the page is not empty for up to an hour after a fresh deploy.
// Only regions with no row yet.
async function runInitialIfEmpty(): Promise<void> {
  try {
    for (const region of REGIONS) {
      const table = playerDistributionByRegion[region];
      const existing = await db.select({ id: table.id }).from(table).limit(1);
      if (existing.length > 0) continue;
      console.log(`[player-distribution-cron] ${region} empty, seeding`);
      try {
        await recomputePlayerDistribution(region);
      } catch (err) {
        console.error(`[player-distribution-cron] ${region} seed failed:`, err);
      }
    }
  } catch (err) {
    console.error("[player-distribution-cron] initial seed failed:", err);
  }
}

export function startPlayerDistributionCron(): void {
  if (
    scheduleCron("player-distribution-cron", SCHEDULE, async () => {
      const n = await refreshPlayerDistributions();
      console.log(
        `[player-distribution-cron] refreshed ${n}/${REGIONS.length} regions`,
      );
    })
  ) {
    console.log(`[player-distribution-cron] scheduled (${SCHEDULE})`);
    void runInitialIfEmpty();
  }
}
