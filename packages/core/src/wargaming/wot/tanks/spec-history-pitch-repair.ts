// One-off repair of the tank history, run by hand from the worker
// (`repair-gun-pitch`). See `repairGunPitch`.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  displaySpecValue,
  type NewTankChange,
  resolveTrackedField,
  tankChanges,
  tankSpecSnapshots,
} from "@unicum.gg/shared";

/** The version whose snapshot was the first one read the right way round. */
const FIRST_FIXED_VERSION = "2.4.1";
/** Every snapshot and change written before this was read the wrong way. The
 * fix (`fa4645b47`, `compute.ts`) landed on 2026-09-05 and the next capture
 * was 2.4.1, on 2026-10-14. */
const FIX_LANDED = new Date("2026-09-06T00:00:00Z");
/** The misread's footprint: a pitch change on this many vehicles in 2.4.1. */
const FOOTPRINT_TANKS = 150;

const DEPRESSION = "depression";
const ELEVATION = "elevation";
const PITCH = [DEPRESSION, ELEVATION];

type PitchRow = { tankId: number; field: string; previous: number | null; next: number | null };

/**
 * Undo what the swapped gun pitch reading did to the tank history.
 *
 * Until `fa4645b47` the client's `maxPitch` was read as elevation and its
 * `minPitch` as depression, the opposite of what they are, so every snapshot
 * before 2.4.1 holds each vehicle's elevation under `depression` and the other
 * way round (the IS-7 at 18 degrees of depression and 6 of elevation). 2.4.1
 * was the first version read correctly, so its diff recorded the two fields
 * trading values on all 1,236 vehicles, a change nobody made, while every
 * pitch change recorded before it is filed under the other field.
 *
 * So this swaps the two values in every snapshot written before the fix,
 * swaps the field of every pitch change recorded before it, and replaces
 * 2.4.1's pitch rows with the changes that version really made, read from
 * those same rows (the swapped previous of one field is the true previous of
 * the other) at the precision the reader sees. Idempotent: it only runs while
 * 2.4.1 still carries the footprint, which it removes.
 */
export async function repairGunPitch({
  apply,
  log = console.log,
}: {
  apply: boolean;
  log?: (line: string) => void;
}): Promise<{ snapshots: number; relabelled: number; dropped: number; kept: number }> {
  // The misread is one capture: the first pass to read 2.4.1 the right way.
  const [first] = await db
    .select({ at: sql<string>`min(${tankChanges.capturedAt})` })
    .from(tankChanges)
    .where(
      and(
        eq(tankChanges.gameVersion, FIRST_FIXED_VERSION),
        inArray(tankChanges.field, PITCH),
      ),
    );
  if (!first?.at) {
    log(`no ${FIRST_FIXED_VERSION} pitch change recorded, nothing to repair`);
    return { snapshots: 0, relabelled: 0, dropped: 0, kept: 0 };
  }
  const capturedAt = new Date(first.at);
  const inCapture = and(
    eq(tankChanges.gameVersion, FIRST_FIXED_VERSION),
    inArray(tankChanges.field, PITCH),
    eq(tankChanges.capturedAt, capturedAt),
  );

  const rows: PitchRow[] = (
    await db
      .select({
        tankId: tankChanges.tankId,
        field: tankChanges.field,
        previous: tankChanges.previous,
        next: tankChanges.next,
      })
      .from(tankChanges)
      .where(inCapture)
  ).map((r) => ({ ...r, tankId: Number(r.tankId) }));

  const footprint = new Set(rows.filter((r) => r.field === DEPRESSION).map((r) => r.tankId));
  if (footprint.size < FOOTPRINT_TANKS) {
    log(`only ${footprint.size} vehicle(s) carry a ${FIRST_FIXED_VERSION} depression change, nothing to repair`);
    return { snapshots: 0, relabelled: 0, dropped: 0, kept: 0 };
  }

  // The changes 2.4.1 really made. A tank's depression row holds its true
  // elevation before and its true depression after, and the other row the
  // reverse, so each field's true previous value is the OTHER row's previous.
  const byTank = new Map<number, Map<string, PitchRow>>();
  for (const r of rows) {
    const fields = byTank.get(r.tankId) ?? new Map<string, PitchRow>();
    fields.set(r.field, r);
    byTank.set(r.tankId, fields);
  }
  const kept: NewTankChange[] = [];
  for (const [tankId, fields] of byTank) {
    for (const [field, other] of [
      [DEPRESSION, ELEVATION],
      [ELEVATION, DEPRESSION],
    ]) {
      const after = fields.get(field!);
      const before = fields.get(other!);
      if (!after || !before) continue;
      const descriptor = resolveTrackedField(field!)!;
      const a = displaySpecValue(descriptor, before.previous);
      const b = displaySpecValue(descriptor, after.next);
      if (a === null || b === null || a === b) continue;
      kept.push({
        tankId,
        gameVersion: FIRST_FIXED_VERSION,
        field: field!,
        previous: before.previous,
        next: after.next,
        capturedAt,
      });
    }
  }
  for (const k of kept) {
    log(`tank ${k.tankId}: ${k.field} ${k.previous} → ${k.next} is a real ${FIRST_FIXED_VERSION} change`);
  }

  const [{ snapshots }] = (await db.execute(sql`
    select count(*)::int as snapshots from ${tankSpecSnapshots}
    where ${tankSpecSnapshots.capturedAt} < ${FIX_LANDED.toISOString()}::timestamptz
      and (${tankSpecSnapshots.data} ? ${DEPRESSION} or ${tankSpecSnapshots.data} ? ${ELEVATION})
  `)) as unknown as [{ snapshots: number }];
  const [{ relabelled }] = (await db.execute(sql`
    select count(*)::int as relabelled from ${tankChanges}
    where ${tankChanges.capturedAt} < ${FIX_LANDED.toISOString()}::timestamptz
      and ${inArray(tankChanges.field, PITCH)}
  `)) as unknown as [{ relabelled: number }];

  log(
    `${snapshots} snapshot(s) to swap, ${relabelled} earlier change(s) to relabel, ` +
      `${rows.length} ${FIRST_FIXED_VERSION} pitch row(s) to drop, ${kept.length} real one(s) to keep`,
  );
  if (!apply) return { snapshots, relabelled, dropped: rows.length, kept: kept.length };

  await db.transaction(async (tx) => {
    // A field that is absent stays absent: jsonb_build_object would write a
    // null where there was nothing.
    await tx.execute(sql`
      update ${tankSpecSnapshots}
      set data = (data - ${DEPRESSION}::text - ${ELEVATION}::text)
        || case when data ? ${ELEVATION} then jsonb_build_object(${DEPRESSION}::text, data -> ${ELEVATION}) else '{}'::jsonb end
        || case when data ? ${DEPRESSION} then jsonb_build_object(${ELEVATION}::text, data -> ${DEPRESSION}) else '{}'::jsonb end
      where ${tankSpecSnapshots.capturedAt} < ${FIX_LANDED.toISOString()}::timestamptz
        and (data ? ${DEPRESSION} or data ? ${ELEVATION})
    `);
    await tx.execute(sql`
      update ${tankChanges}
      set field = case field when ${DEPRESSION} then ${ELEVATION} else ${DEPRESSION} end
      where ${tankChanges.capturedAt} < ${FIX_LANDED.toISOString()}::timestamptz
        and ${inArray(tankChanges.field, PITCH)}
    `);
    await tx.delete(tankChanges).where(inCapture);
    if (kept.length > 0) await tx.insert(tankChanges).values(kept);
  });
  return { snapshots, relabelled, dropped: rows.length, kept: kept.length };
}
