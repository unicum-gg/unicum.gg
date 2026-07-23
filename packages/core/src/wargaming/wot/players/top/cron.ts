import { and, eq } from "drizzle-orm";
import {
  RATING_METRICS,
  playerRatingsByRegion,
  topPlayersByRegion,
} from "@unicum.gg/shared";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { db } from "@unicum.gg/core/db";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { computeTopPlayersAllMetrics, TopPlayersPeriod } from ".";
import { recomputePlayerRatings } from "./ratings";

const SCHEDULE = "0 * * * *";
const TOP_N = 30;
const PERIODS: TopPlayersPeriod[] = [
  TopPlayersPeriod.Day,
  TopPlayersPeriod.Week,
  TopPlayersPeriod.Month,
  TopPlayersPeriod.Overall,
];

export function startTopPlayersCron(): void {
  if (
    scheduleCron("top-players cron", SCHEDULE, async () => {
      await refreshAll();
    })
  ) {
    console.log(`[top-players cron] scheduled (${SCHEDULE})`);
    void runInitialIfEmpty();
  }
}

async function runInitialIfEmpty(): Promise<void> {
  try {
    for (const region of REGIONS) {
      const table = topPlayersByRegion[region];
      const existing = await db
        .select({ rank: table.rank })
        .from(table)
        .limit(1);
      if (existing.length === 0) {
        console.log(`[top-players cron] ${region} empty, running initial refresh`);
        await refreshRegion(region);
        continue;
      }
      // The top-30 board may already be seeded from a prior deploy while the
      // materialized ratings table was just added — seed it independently so
      // the by-language board doesn't return empty until the next hourly tick.
      const ratings = playerRatingsByRegion[region];
      const hasRatings = await db
        .select({ accountId: ratings.accountId })
        .from(ratings)
        .limit(1);
      if (hasRatings.length === 0) {
        console.log(`[top-players cron] ${region} ratings empty, seeding`);
        try {
          const n = await recomputePlayerRatings(region);
          console.log(`[top-players cron] ${region}/ratings seeded: ${n} rows`);
        } catch (err) {
          console.error(`[top-players cron] ${region}/ratings seed failed:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[top-players cron] initial refresh failed:", err);
  }
}

async function refreshAll(): Promise<void> {
  for (const region of REGIONS) {
    await refreshRegion(region);
  }
}

/**
 * Recompute + store one leaderboard period for a region (all metrics). Exported
 * so a one-off (e.g. seeding a newly-added period before the next cron tick) can
 * trigger it directly. Returns the per-metric row counts. */
export async function recomputeTopPlayersPeriod(
  region: Region,
  period: TopPlayersPeriod,
): Promise<number[]> {
  const table = topPlayersByRegion[region];
  const allMetrics = await computeTopPlayersAllMetrics(region, period, TOP_N);
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
          accountId: r.account_id,
          nickname: r.nickname,
          clanTag: r.clan_tag,
          clanColor: r.clan_color,
          battles: r.battles,
          value: r.wnx.toString(),
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
      const counts = await recomputeTopPlayersPeriod(region, period);
      console.log(
        `[top-players cron] ${region}/${period}: ${counts.join("+")} in ${
          Date.now() - start
        }ms`,
      );
    } catch (err) {
      console.error(`[top-players cron] ${region}/${period} failed:`, err);
    }
  }
  // Materialize the language-inferred ratings so the by-language board reads a
  // cheap indexed table instead of re-running the ~5s inference per request.
  try {
    const start = Date.now();
    const n = await recomputePlayerRatings(region);
    console.log(
      `[top-players cron] ${region}/ratings: ${n} rows in ${Date.now() - start}ms`,
    );
  } catch (err) {
    console.error(`[top-players cron] ${region}/ratings failed:`, err);
  }
}
