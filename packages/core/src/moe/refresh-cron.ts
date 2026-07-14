import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { type NewTankMoe, moeByRegion } from "@unicum.gg/core/db/schema";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { fetchMoeFromPoliroid } from "./poliroid";

// Poliroid recomputes daily; run just after the mastery cron (07:15) so both
// poliroid mirrors settle in the same morning window.
const MOE_SCHEDULE = "30 7 * * *"; // Every day at 07:30 server time

const INSERT_CHUNK = 500;

/**
 * Mirror one region's Marks of Excellence thresholds from the provider into the
 * per-region `xx_tank_moe` table. Upserts by tank id so tanks that drop out of
 * the provider keep their last known values until overwritten. Returns the
 * number of tanks written.
 */
export async function refreshTankMoe(region: Region): Promise<number> {
  const entries = await fetchMoeFromPoliroid(region);
  if (entries.length === 0) return 0;

  const table = moeByRegion[region];
  const now = new Date();
  const rows: NewTankMoe[] = entries.map((e) => ({
    tankId: e.tankId,
    mark1: e.mark1,
    mark2: e.mark2,
    mark3: e.mark3,
    updatedAt: now,
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await db
      .insert(table)
      .values(rows.slice(i, i + INSERT_CHUNK))
      .onConflictDoUpdate({
        target: table.tankId,
        set: {
          mark1: sql`excluded.mark1`,
          mark2: sql`excluded.mark2`,
          mark3: sql`excluded.mark3`,
          updatedAt: now,
        },
      });
  }
  return rows.length;
}

export function startMoeCron(): void {
  if (
    scheduleCron("moe-cron", MOE_SCHEDULE, async () => {
      await refreshMoeAllRegions();
    })
  ) {
    console.log(`[moe-cron] scheduled (${MOE_SCHEDULE})`);
  }
}

async function refreshMoeAllRegions(): Promise<void> {
  for (const region of REGIONS) {
    try {
      const count = await refreshTankMoe(region);
      console.log(`[moe-cron] ${region} refreshed (${count} tanks)`);
    } catch (err) {
      // Provider outage is normal operation: keep the last snapshot, don't let
      // one region's failure abort the others.
      console.error(`[moe-cron] ${region} refresh failed:`, err);
    }
  }
}
