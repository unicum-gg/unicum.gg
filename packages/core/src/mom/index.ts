import { db } from "@unicum.gg/core/db";
import { type TankMom, momByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

// The XP thresholds for the four Mark of Mastery badges, keyed by tank id.
export type MomValues = Pick<
  TankMom,
  "class3" | "class2" | "class1" | "ace"
>;

/**
 * Every tank's Mark of Mastery thresholds for one region, keyed by tank id.
 * Powers the /tanks Marks of Mastery table. Reads our mirror table (refreshed
 * daily by the mastery cron), never the upstream provider, so a poliroid outage
 * can never break the page: a cold table just yields an empty map and the cells
 * render "—".
 */
export async function getTankMomByRegion(
  region: Region,
): Promise<Map<number, MomValues>> {
  const table = momByRegion[region];
  const rows = await db
    .select({
      tankId: table.tankId,
      class3: table.class3,
      class2: table.class2,
      class1: table.class1,
      ace: table.ace,
    })
    .from(table);
  return new Map(
    rows.map((r) => [
      r.tankId,
      { class3: r.class3, class2: r.class2, class1: r.class1, ace: r.ace },
    ]),
  );
}
