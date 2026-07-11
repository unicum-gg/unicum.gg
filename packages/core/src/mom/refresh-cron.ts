import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { type NewTankMom, momByRegion } from "@unicum.gg/core/db/schema";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { REGIONS, type Region } from "@unicum.gg/wargaming/region";
import { fetchMomFromPoliroid } from "./poliroid";

// Poliroid recomputes daily; run shortly after the vehicles cron (07:00) so a
// fresh tank added at a patch already has a catalogue row to hang mastery off.
const MOM_SCHEDULE = "15 7 * * *"; // Every day at 07:15 server time

const INSERT_CHUNK = 500;

/**
 * Mirror one region's Mark of Mastery thresholds from the provider into the
 * per-region `xx_tank_mom` table. Upserts by tank id so tanks that drop out
 * of the provider keep their last known values until overwritten. Returns the
 * number of tanks written.
 */
export async function refreshTankMom(region: Region): Promise<number> {
  const entries = await fetchMomFromPoliroid(region);
  if (entries.length === 0) return 0;

  const table = momByRegion[region];
  const now = new Date();
  const rows: NewTankMom[] = entries.map((e) => ({
    tankId: e.tankId,
    class3: e.class3,
    class2: e.class2,
    class1: e.class1,
    ace: e.ace,
    updatedAt: now,
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await db
      .insert(table)
      .values(rows.slice(i, i + INSERT_CHUNK))
      .onConflictDoUpdate({
        target: table.tankId,
        set: {
          class3: sql`excluded.class3`,
          class2: sql`excluded.class2`,
          class1: sql`excluded.class1`,
          ace: sql`excluded.ace`,
          updatedAt: now,
        },
      });
  }
  return rows.length;
}

export function startMomCron(): void {
  if (
    scheduleCron("mom-cron", MOM_SCHEDULE, async () => {
      await refreshMomAllRegions();
    })
  ) {
    console.log(`[mom-cron] scheduled (${MOM_SCHEDULE})`);
  }
}

async function refreshMomAllRegions(): Promise<void> {
  for (const region of REGIONS) {
    try {
      const count = await refreshTankMom(region);
      console.log(`[mom-cron] ${region} refreshed (${count} tanks)`);
    } catch (err) {
      // Provider outage is normal operation: keep the last snapshot, don't
      // let one region's failure abort the others.
      console.error(`[mom-cron] ${region} refresh failed:`, err);
    }
  }
}
