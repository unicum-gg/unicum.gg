import { eq } from "drizzle-orm";
import { RATING_METRICS } from "@unicum.gg/core/constants/rating";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { db } from "@unicum.gg/core/db";
import { topClansByRegion } from "@unicum.gg/core/db/schema";
import { REGIONS } from "@unicum.gg/wargaming/region";
import { computeTopClansByMetric } from ".";

const SCHEDULE = "0 * * * *";
const TOP_N = 30;

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

async function refreshRegion(region: (typeof REGIONS)[number]): Promise<void> {
  const table = topClansByRegion[region];
  for (const metric of RATING_METRICS) {
    const start = Date.now();
    try {
      const results = await computeTopClansByMetric(region, metric, TOP_N);
      await db.transaction(async (tx) => {
        await tx.delete(table).where(eq(table.metric, metric));
        if (results.length > 0) {
          await tx.insert(table).values(
            results.map((r, i) => ({
              metric,
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
      console.log(
        `[top-clans cron] ${region}/${metric}: ${results.length} clans in ${
          Date.now() - start
        }ms`,
      );
    } catch (err) {
      console.error(`[top-clans cron] ${region}/${metric} failed:`, err);
    }
  }
}
