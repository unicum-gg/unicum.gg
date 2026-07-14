import { and, eq } from "drizzle-orm";
import { RATING_METRICS } from "@unicum.gg/core/constants/rating";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { db } from "@unicum.gg/core/db";
import { topPlayersByRegion } from "@unicum.gg/core/db/schema";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { computeTopPlayersAllMetrics, TopPlayersPeriod } from ".";

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
}
