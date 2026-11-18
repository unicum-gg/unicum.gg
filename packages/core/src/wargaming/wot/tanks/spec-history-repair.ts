// One-off repair of the tank history, run by hand from the worker
// (`repair-untagged-baselines`). See `repairUntaggedBaselines`.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { cleanupOscillations, diffTrackedSpecs } from "./spec-history";
import {
  type NewTankChange,
  tankChanges,
  tankIntroductions,
  tankSpecSnapshots,
} from "@unicum.gg/shared";

type Pair = {
  tank_id: number;
  prev_version: string;
  prev_data: Record<string, number>;
  next_version: string;
  next_data: Record<string, number>;
  next_tag: string;
  next_at: Date;
  dev_version: string | null;
};

/**
 * Undo what the untagged baselines did to the tank history.
 *
 * The baselines the backfill wrote before `tank_spec_snapshots.tag` existed
 * carry no tag, and the forward diff read that null as "WG reused this slot for
 * another vehicle". So at the first version bump after them (2.4) it released
 * 91 tanks that had been in the game for a decade (the IS-7, the MS-1, the
 * T-34) and recorded none of that patch's rebalances on any of them, since a new
 * vehicle is baselined rather than diffed. `recordSpecChanges` no longer does
 * that; this puts back what it already did.
 *
 * For each tank whose untagged baseline was followed by a release the forward
 * pass wrote at that very snapshot, it drops the release, writes the diff
 * between the two snapshots as the changes it should have been, and tags the
 * old baseline. Idempotent: what it selects on is the missing tag it fills in.
 */
export async function repairUntaggedBaselines({
  apply,
  log = console.log,
}: {
  apply: boolean;
  log?: (line: string) => void;
}): Promise<{ tanks: number; changes: number }> {

  // An untagged baseline, the snapshot that followed it, and a release dated to
  // that snapshot: the exact footprint of the misread, nothing else.
  const pairs = (await db.execute(sql`
    select p.tank_id, p.game_version as prev_version, p.data as prev_data,
           n.game_version as next_version, n.data as next_data,
           n.tag as next_tag, n.captured_at as next_at, i.dev_version
    from tank_spec_snapshots p
    join lateral (
      select * from tank_spec_snapshots n
      where n.tank_id = p.tank_id and n.captured_at > p.captured_at
      order by n.captured_at
      limit 1
    ) n on true
    join tank_introductions i
      on i.tank_id = p.tank_id
     and i.released_version = n.game_version
     and i.released_at = n.captured_at
    where p.tag is null and n.tag is not null
  `)) as unknown as Pair[];

  let changes = 0;
  for (const pair of pairs) {
    const rows: NewTankChange[] = diffTrackedSpecs(
      pair.prev_data,
      pair.next_data,
    ).map((change) => ({
      tankId: pair.tank_id,
      gameVersion: pair.next_version,
      capturedAt: new Date(pair.next_at),
      ...change,
    }));
    changes += rows.length;
    log(
      `${pair.next_tag}: release in ${pair.next_version} dropped, ${rows.length} change(s) since ${pair.prev_version}`,
    );
    if (!apply) continue;

    await db.transaction(async (tx) => {
      if (rows.length > 0) await tx.insert(tankChanges).values(rows);
      // A tank also sighted on the test client keeps that line; only the
      // release the misread invented goes.
      if (pair.dev_version) {
        await tx
          .update(tankIntroductions)
          .set({ releasedVersion: null, releasedAt: null, updatedAt: new Date() })
          .where(eq(tankIntroductions.tankId, pair.tank_id));
      } else {
        await tx
          .delete(tankIntroductions)
          .where(eq(tankIntroductions.tankId, pair.tank_id));
      }
      await tx
        .update(tankSpecSnapshots)
        .set({ tag: pair.next_tag })
        .where(
          and(
            eq(tankSpecSnapshots.tankId, pair.tank_id),
            eq(tankSpecSnapshots.gameVersion, pair.prev_version),
          ),
        );
    });
  }

  if (apply && pairs.length > 0) await cleanupOscillations();
  return { tanks: pairs.length, changes };
}
