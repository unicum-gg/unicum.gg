import { scheduleCron } from "@/services/cron/scheduler";
import { db } from "@/services/db";
import { tankAggregatesByRegion } from "@/services/db/schema";
import { REGIONS, type Region } from "@/services/wargaming/wot";
import { recomputeTankAggregates } from "./aggregates";

// 03:30 daily. Off-peak, and staggered away from the 04:00 weekly discovery
// walk and the 07:00 vehicle-catalogue refresh so the nightly snapshot sort
// doesn't contend with them for the single VPS.
const SCHEDULE = "30 3 * * *";

export function startTankAggregatesCron(): void {
  if (
    scheduleCron("tank-aggregates cron", SCHEDULE, async () => {
      await refreshAll();
    })
  ) {
    console.log(`[tank-aggregates cron] scheduled (${SCHEDULE})`);
    void runInitialIfEmpty();
  }
}

async function runInitialIfEmpty(): Promise<void> {
  try {
    for (const region of REGIONS) {
      const table = tankAggregatesByRegion[region];
      const existing = await db
        .select({ tankId: table.tankId })
        .from(table)
        .limit(1);
      if (existing.length === 0) {
        console.log(
          `[tank-aggregates cron] ${region} empty, running initial roll-up`,
        );
        await refreshRegion(region);
      }
    }
  } catch (err) {
    console.error("[tank-aggregates cron] initial roll-up failed:", err);
  }
}

async function refreshAll(): Promise<void> {
  for (const region of REGIONS) {
    await refreshRegion(region);
  }
}

async function refreshRegion(region: Region): Promise<void> {
  try {
    const start = Date.now();
    const tanks = await recomputeTankAggregates(region);
    console.log(
      `[tank-aggregates cron] ${region}: ${tanks} tanks in ${Date.now() - start}ms`,
    );
  } catch (err) {
    console.error(`[tank-aggregates cron] ${region} failed:`, err);
  }
}
