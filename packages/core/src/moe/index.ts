import { db } from "@unicum.gg/core/db";
import { type TankMoe, moeByRegion } from "@unicum.gg/core/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";

// The combined-damage thresholds for the three Marks of Excellence, keyed by
// tank id.
export type MoeValues = Pick<TankMoe, "mark1" | "mark2" | "mark3">;

/**
 * Every tank's Marks of Excellence thresholds for one region, keyed by tank id.
 * Powers the /tanks Marks of Excellence table. Reads our mirror table (refreshed
 * daily by the moe cron), never the upstream provider, so a poliroid outage can
 * never break the page: a cold table just yields an empty map and the cells
 * render "—".
 */
export async function getTankMoeByRegion(
  region: Region,
): Promise<Map<number, MoeValues>> {
  const table = moeByRegion[region];
  const rows = await db
    .select({
      tankId: table.tankId,
      mark1: table.mark1,
      mark2: table.mark2,
      mark3: table.mark3,
    })
    .from(table);
  return new Map(
    rows.map((r) => [
      r.tankId,
      { mark1: r.mark1, mark2: r.mark2, mark3: r.mark3 },
    ]),
  );
}
