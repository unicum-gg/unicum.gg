import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  type NewTankTestChange,
  tankTestChanges,
  type TankTestChange,
} from "@unicum.gg/shared";
import { diffTrackedSpecs, isPlayerTank, pickTrackedFields } from "./spec-history";

/** One characteristic the test build changes, with both sides. */
export type TestChange = {
  field: string;
  /** The live client's value. */
  previous: number | null;
  /** The test client's value. */
  next: number | null;
};

/**
 * Compare the two catalogues and record what the test build changes about
 * vehicles the live one already has.
 *
 * This is the half of a Common Test the catalogue was blind to. Adding the
 * test-only vehicles was the visible part; the rebalances are what a player
 * actually reads a test build for, and they touch tanks that have been in the
 * game for years.
 *
 * The table is replaced rather than appended to: a test build is rebalanced
 * mid-test and disappears when it ships, so yesterday's diff is noise rather
 * than history. What shipped is `tank_changes`, which is append-only.
 */
export async function recordTestChanges(
  live: Array<{ tankId: number } & Record<string, unknown>>,
  test: Array<{ tankId: number } & Record<string, unknown>>,
  testVersion: string,
): Promise<number> {
  const liveById = new Map(live.map((s) => [s.tankId, s]));
  const rows: NewTankTestChange[] = [];
  const capturedAt = new Date();

  for (const spec of test) {
    const before = liveById.get(spec.tankId);
    if (!before) continue; // test-only vehicle: it changes nothing, it is new
    const tag = typeof spec.tag === "string" ? spec.tag : null;
    // Bots, bootcamp dummies and mode variants are not tanks anyone plays.
    if (!isPlayerTank(tag)) continue;
    for (const change of diffTrackedSpecs(
      pickTrackedFields(before),
      pickTrackedFields(spec),
    )) {
      rows.push({ tankId: spec.tankId, testVersion, capturedAt, ...change });
    }
  }

  // Swap in one transaction: a reader must never see the table half-empty, and
  // an empty test build (none running) correctly leaves nothing behind.
  await db.transaction(async (tx) => {
    await tx.delete(tankTestChanges);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      if (chunk.length > 0) await tx.insert(tankTestChanges).values(chunk);
    }
  });
  return rows.length;
}

/**
 * Forget the pending test changes.
 *
 * For when there is no longer a test to report: the build shipped, or the branch
 * turned out not to be ahead of the live one. What it changed is either live now
 * (and `tank_changes` has it) or was never real, so leaving the rows would keep
 * a "not released yet" panel on tanks the update already reached.
 */
export async function clearTestChanges(): Promise<void> {
  await db.delete(tankTestChanges);
}

/** How many characteristics the test build changes, per tank id. Empty when no
 * test is running. Small enough to read whole (a test touches a few dozen). */
export async function getTestChangeCounts(): Promise<Map<number, number>> {
  const rows = await db
    .select({
      tankId: tankTestChanges.tankId,
      count: sql<number>`count(*)::int`,
    })
    .from(tankTestChanges)
    .groupBy(tankTestChanges.tankId);
  return new Map(rows.map((r) => [r.tankId, r.count]));
}

/** Everything the running test build changes about one tank, with the build it
 * was read from. `version` is null when nothing is pending for this tank. */
export async function getTestChanges(
  tankId: number,
): Promise<{ version: string | null; changes: TestChange[] }> {
  const rows: TankTestChange[] = await db
    .select()
    .from(tankTestChanges)
    .where(sql`${tankTestChanges.tankId} = ${tankId}`);
  return {
    version: rows[0]?.testVersion ?? null,
    changes: rows.map((r) => ({ field: r.field, previous: r.previous, next: r.next })),
  };
}

/**
 * The test build that rebalances this tank, or null when none does.
 *
 * What the tank page needs to know before offering to show the test client's
 * numbers: the full diff is the History tab's business, this is only whether
 * there is one and which build it came from.
 */
export async function getTestVersion(tankId: number): Promise<string | null> {
  const rows = await db
    .select({ testVersion: tankTestChanges.testVersion })
    .from(tankTestChanges)
    .where(sql`${tankTestChanges.tankId} = ${tankId}`)
    .limit(1);
  return rows[0]?.testVersion ?? null;
}

/**
 * The specification as the running test build has it: the live row with the
 * test's values written over the characteristics it changes.
 *
 * For readers that hold a live spec row and need the test one without going back
 * to the client data for it, which is what the recorded diff is for. The values
 * are the same either way: the diff is what a comparison of the two catalogues
 * produced in the first place.
 *
 * Only the vehicle's own scalars and its default shell land: a `shell:0:...`
 * change is the shell a spec row already describes (`damage`, `penetration`,
 * ...), while the other shells and the tier-XI ability parameters have no column
 * on a spec row to be written into.
 */
export function applyTestChanges<T extends Record<string, unknown>>(
  spec: T,
  changes: TestChange[],
): T {
  const out: Record<string, unknown> = { ...spec };
  for (const { field, next } of changes) {
    if (next === null) continue;
    if (!field.includes(":")) {
      out[field] = next;
      continue;
    }
    const shell = /^shell:0:[^:]*:(.+)$/.exec(field);
    if (shell) out[shell[1]] = next;
  }
  return out as T;
}
