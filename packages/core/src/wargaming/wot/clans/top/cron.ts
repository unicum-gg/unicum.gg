import { and, eq } from "drizzle-orm";
import {
  RATING_METRICS,
  clanRatingsByRegion,
  topClansByRegion,
} from "@unicum.gg/shared";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { db } from "@unicum.gg/core/db";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { computeTopClansAllMetrics, TopClansPeriod } from ".";
import { recomputeClanRatings } from "./ratings";

const SCHEDULE = "0 * * * *";
const TOP_N = 30;
const PERIODS: TopClansPeriod[] = [
  TopClansPeriod.Overall,
  TopClansPeriod.Month,
];

export function startTopClansCron(): void {
  if (
    scheduleCron("top-clans cron", SCHEDULE, async () => {
      await refreshAllRegions();
    })
  ) {
    console.log(`[top-clans cron] scheduled (${SCHEDULE})`);
    void runInitialIfEmpty();
  }
}

async function runInitialIfEmpty(): Promise<void> {
  try {
    for (const region of REGIONS) {
      const table = topClansByRegion[region];
      const existing = await db.select({ rank: table.rank }).from(table).limit(1);
      if (existing.length === 0) {
        console.log(`[top-clans cron] ${region} empty, running initial refresh`);
        await refreshRegion(region);
        continue;
      }
      // The top-30 board may already be seeded from a prior deploy while the
      // materialized ratings table was just added — seed it independently so
      // the by-language boards don't return empty until the next hourly tick.
      const ratings = clanRatingsByRegion[region];
      const hasRatings = await db
        .select({ clanId: ratings.clanId })
        .from(ratings)
        .limit(1);
      if (hasRatings.length === 0) {
        console.log(`[top-clans cron] ${region} ratings empty, seeding`);
        try {
          const n = await recomputeClanRatings(region);
          console.log(`[top-clans cron] ${region}/ratings seeded: ${n} rows`);
        } catch (err) {
          console.error(`[top-clans cron] ${region}/ratings seed failed:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[top-clans cron] initial refresh failed:", err);
  }
}

async function refreshAllRegions(): Promise<void> {
  for (const region of REGIONS) {
    try {
      await refreshRegion(region);
    } catch (err) {
      console.error(`[top-clans cron] ${region} failed:`, err);
    }
  }
}

/**
 * Recompute + store one leaderboard period for a region (all metrics). Exported
 * so a one-off (e.g. seeding a newly-added period before the next cron tick) can
 * trigger it directly. Returns the per-metric row counts. */
export async function recomputeTopClansPeriod(
  region: Region,
  period: TopClansPeriod,
): Promise<number[]> {
  const table = topClansByRegion[region];
  const allMetrics = await computeTopClansAllMetrics(region, period, TOP_N);
  const counts: number[] = [];
  await db.transaction(async (tx) => {
    for (const metric of RATING_METRICS) {
      const results = allMetrics[metric];
      counts.push(results.length);
      await tx
        .delete(table)
        .where(and(eq(table.metric, metric), eq(table.period, period)));
      if (results.length === 0) continue;
      await tx.insert(table).values(
        results.map((r, i) => ({
          metric,
          period,
          rank: i + 1,
          clanId: r.clan_id,
          tag: r.tag,
          name: r.name,
          color: r.color,
          emblem: r.emblem,
          membersCount: r.members_count,
          ratedMembersCount: r.rated_members_count,
          avgValue: r.avg_wnx.toString(),
        })),
      );
    }
  });
  return counts;
}

async function refreshRegion(region: Region): Promise<void> {
  for (const period of PERIODS) {
    try {
      const start = Date.now();
      const counts = await recomputeTopClansPeriod(region, period);
      console.log(
        `[top-clans cron] ${region}/${period}: ${counts.join("+")} in ${
          Date.now() - start
        }ms`,
      );
    } catch (err) {
      console.error(`[top-clans cron] ${region}/${period} failed:`, err);
    }
  }
  // Materialize the full per-clan ratings so the by-language boards read a
  // cheap indexed table instead of re-running the ~8s aggregation per request.
  try {
    const start = Date.now();
    const n = await recomputeClanRatings(region);
    console.log(
      `[top-clans cron] ${region}/ratings: ${n} rows in ${Date.now() - start}ms`,
    );
  } catch (err) {
    console.error(`[top-clans cron] ${region}/ratings failed:`, err);
  }
}
