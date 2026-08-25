import { desc, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  displaySpecValue,
  MECHANICS_PREFIX,
  type NewTankChange,
  type NewTankIntroduction,
  type NewTankSpecSnapshot,
  resolveTrackedField,
  SHELL_PREFIX,
  SHELL_STATS,
  TRACKED_SPEC_FIELD_KEYS,
  TRACKED_SPEC_FIELDS,
  tankChanges,
  tankIntroductions,
  tankSpecSnapshots,
} from "@unicum.gg/shared";
import { currentGameVersion } from "@unicum.gg/core/wargaming/wot/game-version";

const INSERT_CHUNK = 500;

/**
 * The vehicles seen on the test client and never yet on a live one, by id.
 *
 * A test sighting already leaves a snapshot behind, so the run after the vehicle
 * ships finds a baseline and would treat its release as an ordinary version
 * bump. This is what lets that run tell the two apart.
 */
async function loadUnreleasedDevSightings(): Promise<Set<number>> {
  const rows = await db
    .select({ tankId: tankIntroductions.tankId })
    .from(tankIntroductions)
    .where(
      sql`${tankIntroductions.devVersion} is not null and ${tankIntroductions.releasedVersion} is null`,
    );
  return new Set(rows.map((r) => r.tankId));
}

/** Project any spec-shaped object onto the tracked numeric fields (raw stored
 * scale). Works on a `NewTankSpec` (forward) or a wot-src `WotSrcSpec` (backfill),
 * since both carry the tracked fields under the same camelCase keys. */
export function pickTrackedFields(
  spec: Record<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of TRACKED_SPEC_FIELD_KEYS) {
    const v = spec[key];
    if (typeof v === "number") out[key] = v;
  }
  // Per-shell firepower stats (the WotSrcSpec `shellStats[]`), keyed
  // `shell:<index>:<type>:<stat>` so a change is attributed to a specific shell.
  const shells = spec.shellStats;
  if (Array.isArray(shells)) {
    shells.forEach((shell, i) => {
      if (!shell || typeof shell !== "object") return;
      const s = shell as Record<string, unknown>;
      const type = typeof s.type === "string" ? s.type : "shell";
      for (const { stat, from } of SHELL_STATS) {
        const v = s[from];
        if (typeof v === "number")
          out[`${SHELL_PREFIX}${i}:${type}:${stat}`] = v;
      }
    });
  }
  // Tier-XI ability parameters (the WotSrcSpec `mechanics` path->value map) are
  // flattened under a `mechanics:` prefix, so they diff alongside the base
  // fields but stay distinguishable for display.
  const mech = spec.mechanics;
  if (mech && typeof mech === "object") {
    for (const [k, v] of Object.entries(mech as Record<string, unknown>)) {
      if (typeof v === "number") out[`${MECHANICS_PREFIX}${k}`] = v;
    }
  }
  return out;
}

/**
 * Whether a spec is a real, released vehicle rather than a dev stub. WG ships
 * unreleased tanks in the client with placeholder stats (a dispersion of 10,
 * a health of 100, ...), which would otherwise diff as an absurd mega-change the
 * day the tank gets its real values. Dispersion is a physical distance that is
 * always well under 1m for any real gun, so a value above 1.5 is an unambiguous
 * placeholder. Keeps a tank's history starting at release, not at its stub.
 */
export function isReleasedSpec(data: Record<string, number>): boolean {
  const dispersion = data.accuracy;
  if (typeof dispersion === "number" && dispersion > 1.5) return false;
  return true;
}

/**
 * The field changes between two tracked-spec baselines, at each field's display
 * precision (so a recorded change is exactly a change the reader would see). Only
 * fields present as numbers on both sides are comparable. Shared by the forward
 * cron diff and the historical backfill.
 */
export function diffTrackedSpecs(
  prev: Record<string, number>,
  next: Record<string, number>,
): SpecChange[] {
  const changes: SpecChange[] = [];
  const keysWith = (prefix: string) =>
    [
      ...new Set([...Object.keys(prev), ...Object.keys(next)]),
    ]
      .filter((k) => k.startsWith(prefix))
      .sort();

  // A field with a descriptor (base or per-shell): compared at display precision,
  // so a recorded change is exactly one the reader can see.
  const diffAt = (key: string) => {
    const field = resolveTrackedField(key);
    if (!field) return;
    const a = prev[key];
    const b = next[key];
    if (typeof a !== "number" || typeof b !== "number") return;
    const shownBefore = displaySpecValue(field, a);
    const shownAfter = displaySpecValue(field, b);
    if (shownBefore === null || shownAfter === null || shownBefore === shownAfter)
      return;
    changes.push({ field: key, previous: a, next: b });
  };

  // Base spec fields (in their defined order), then per-shell firepower.
  for (const field of TRACKED_SPEC_FIELDS) diffAt(field.key);
  for (const key of keysWith(SHELL_PREFIX)) diffAt(key);

  // Tier-XI ability parameters: exact config values, so a plain inequality with
  // a tiny epsilon to absorb float32 storage noise.
  for (const key of keysWith(MECHANICS_PREFIX)) {
    const a = prev[key];
    const b = next[key];
    if (typeof a !== "number" || typeof b !== "number") continue;
    if (Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) continue;
    changes.push({ field: key, previous: a, next: b });
  }
  return changes;
}

type LatestSnapshot = {
  gameVersion: string;
  data: Record<string, number>;
  tag: string | null;
};

/** The most recent snapshot of every tank (the baseline the next version diffs
 * against), keyed by tank id. */
async function loadLatestSnapshots(): Promise<Map<number, LatestSnapshot>> {
  const rows = await db
    .selectDistinctOn([tankSpecSnapshots.tankId], {
      tankId: tankSpecSnapshots.tankId,
      gameVersion: tankSpecSnapshots.gameVersion,
      data: tankSpecSnapshots.data,
      tag: tankSpecSnapshots.tag,
    })
    .from(tankSpecSnapshots)
    .orderBy(tankSpecSnapshots.tankId, desc(tankSpecSnapshots.capturedAt));
  return new Map(
    rows.map((r) => [
      r.tankId,
      { gameVersion: r.gameVersion, data: r.data, tag: r.tag },
    ]),
  );
}

/**
 * A wot-src vehicle tag that is NOT a real player tank: bots, bootcamp/training
 * dummies, Halloween/event and mode-only (7x7, RTS) variants. These occupy real
 * `tank_id` slots but are never a tank a player owns, so they are excluded from
 * the spec history entirely: they must not get a baseline, a change, or an
 * introduction, and a slot flipping from one of them to a real tank is that real
 * tank's release (not a diff). The site's feed already hides them (absent from
 * the WG encyclopedia), but excluding them here keeps the tables clean and makes
 * the reused-slot handling exact.
 */
export function isPlayerTank(tag: string | null | undefined): boolean {
  if (!tag) return true; // unknown tag: don't over-filter, treat as a real tank
  return (
    !/(?:^|_)(bot|bootcamp|training|hell|bob|boss|event|halloween|rts)(?:_|$)/i.test(
      tag,
    ) && !/HW_BOT|WT_bot/i.test(tag)
  );
}

async function insertChunked<T>(
  values: T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < values.length; i += INSERT_CHUNK) {
    await write(values.slice(i, i + INSERT_CHUNK));
  }
}

/**
 * Record what changed in the freshly refreshed tank specs since the last game
 * version, building the change history forward one patch at a time.
 *
 * Called at the end of the vehicles cron's `refreshTankSpecs`, with the same
 * rows it just upserted. Bots and event/mode variants are skipped (isPlayerTank).
 * For each real tank it compares the new specs to its frozen baseline snapshot:
 * - no baseline yet, or the baseline's tag differs (WG reused this slot id for a
 *   different vehicle) → seed a fresh baseline at the current version and record
 *   the introduction; a first sighting (or a new occupant) is not a "change".
 * - baseline is already this version → nothing to do (the per-version snapshot
 *   is immutable, so a mid-patch mirror correction never looks like a balance
 *   change).
 * - same tag, older version (a real bump) → diff every tracked field at its
 *   display precision, write a `tank_changes` row per visible move, then freeze
 *   the new baseline.
 *
 * Fails soft: the caller wraps this so a history hiccup never breaks the daily
 * catalogue refresh.
 */
export async function recordSpecChanges(
  specs: Array<{ tankId: number } & Record<string, unknown>>,
  /**
   * Vehicles that exist only on the Common Test client. They are recorded as a
   * pre-release sighting rather than a release: the version we can read is the
   * live one, so calling this an introduction would date the tank to a build it
   * does not appear in. The release line is written when it ships and the
   * catalogue stops flagging it.
   */
  commonTest: ReadonlySet<number> = new Set(),
): Promise<{ version: string | null; snapshots: number; changes: number }> {
  const version = await currentGameVersion();
  if (!version || specs.length === 0)
    return { version, snapshots: 0, changes: 0 };

  const [latest, awaitingRelease] = await Promise.all([
    loadLatestSnapshots(),
    loadUnreleasedDevSightings(),
  ]);
  const snapshots: NewTankSpecSnapshot[] = [];
  const changes: NewTankChange[] = [];
  const intros: NewTankIntroduction[] = [];
  const capturedAt = new Date();

  for (const spec of specs) {
    const tankId = spec.tankId;
    if (typeof tankId !== "number") continue;
    const tag = typeof spec.tag === "string" ? spec.tag : null;
    // Bots, bootcamp dummies and event/mode variants are not real tanks: keep
    // them out of the history entirely (see isPlayerTank).
    if (!isPlayerTank(tag)) continue;
    const data = pickTrackedFields(spec);
    const prev = latest.get(tankId);

    // A dev stub (placeholder stats) is not a real tank yet: skip it.
    if (!isReleasedSpec(data)) continue;

    if (!prev) {
      // First sighting of a tank we've never snapshotted = its release, unless
      // it is only on the test client, which is a sighting and not a release.
      intros.push(
        commonTest.has(tankId)
          ? { tankId, devVersion: version, devAt: capturedAt }
          : { tankId, releasedVersion: version, releasedAt: capturedAt },
      );
      snapshots.push({ tankId, gameVersion: version, tag, data, capturedAt });
      continue;
    }
    // Already baselined at this version: no-op (the per-version snapshot is
    // immutable). Checked before the tag test so a same-version re-run is inert
    // even if the stored tag was derived slightly differently.
    if (prev.gameVersion === version) continue;
    if (prev.tag !== tag) {
      // The slot's tag changed at a version bump: WG reused this id for a
      // different vehicle. That is the new tank's release, not a change; seed a
      // fresh baseline and record the introduction (never diff across vehicles).
      intros.push({ tankId, releasedVersion: version, releasedAt: capturedAt });
      snapshots.push({ tankId, gameVersion: version, tag, data, capturedAt });
      continue;
    }
    if (awaitingRelease.has(tankId) && !commonTest.has(tankId)) {
      // Seen on the test client before, in the live catalogue now: this is the
      // release the pre-release sighting was waiting for. Recorded as one rather
      // than diffed, because the baseline it would be diffed against is the test
      // build's, and what a test build changed on its way to shipping never
      // happened on a live server. Re-baselined on the released values so the
      // next patch diffs against what players actually got.
      intros.push({ tankId, releasedVersion: version, releasedAt: capturedAt });
      snapshots.push({ tankId, gameVersion: version, tag, data, capturedAt });
      continue;
    }

    for (const change of diffTrackedSpecs(prev.data, data)) {
      changes.push({ tankId, gameVersion: version, capturedAt, ...change });
    }
    snapshots.push({ tankId, gameVersion: version, tag, data, capturedAt });
  }

  await insertChunked(snapshots, (chunk) =>
    db.insert(tankSpecSnapshots).values(chunk).onConflictDoNothing(),
  );
  await insertChunked(changes, (chunk) => db.insert(tankChanges).values(chunk));
  // Record each new tank's introduction, filling only the fields still missing
  // (COALESCE) so the backfill's earlier dates are never clobbered.
  await insertChunked(intros, (chunk) =>
    db
      .insert(tankIntroductions)
      .values(chunk)
      .onConflictDoUpdate({
        target: tankIntroductions.tankId,
        set: {
          devVersion: sql`coalesce(${tankIntroductions.devVersion}, excluded.dev_version)`,
          devAt: sql`coalesce(${tankIntroductions.devAt}, excluded.dev_at)`,
          releasedVersion: sql`coalesce(${tankIntroductions.releasedVersion}, excluded.released_version)`,
          releasedAt: sql`coalesce(${tankIntroductions.releasedAt}, excluded.released_at)`,
          updatedAt: sql`now()`,
        },
      }),
  );

  // Sweep oscillation artifacts every tick, not just in the backfill: the same
  // multi-config reward tanks whose `topModuleKey` pick flips each version would
  // otherwise re-emit a fake buff/nerf on every patch and accumulate forever.
  await cleanupOscillations();

  return { version, snapshots: snapshots.length, changes: changes.length };
}

/**
 * Delete pure-oscillation artifacts. A handful of multi-config reward tanks (WT
 * E 100, Walküre, ...) carry two module sets whose XML order flips between client
 * versions, so `topModuleKey` (last-listed module) picks a different "top" gun
 * each version and a field toggles between the same two values every patch. Real
 * balance never oscillates like that, so a (tank, field) with >= 3 recorded
 * changes but only <= 2 distinct values on each side is derivation noise, not
 * history, and is removed wholesale. Runs after both the forward diff and the
 * backfill cascade. Returns rows deleted.
 *
 * Caveat: a field that legitimately toggled between exactly two values across >=3
 * patches would be swept too (indistinguishable from the artifact), and
 * `count(DISTINCT)` ignores NULLs so appeared/disappeared fields undercount; both
 * are acceptable since this targets the known reward-tank noise.
 */
export async function cleanupOscillations(): Promise<number> {
  // postgres.js reports affected rows for a DELETE on the result's `count`.
  const res = (await db.execute(sql`
    DELETE FROM ${tankChanges}
    WHERE (tank_id, field) IN (
      SELECT tank_id, field FROM ${tankChanges}
      GROUP BY tank_id, field
      HAVING count(*) >= 3
         AND count(DISTINCT next) <= 2
         AND count(DISTINCT previous) <= 2
    )
  `)) as unknown as { count?: number };
  return res.count ?? 0;
}

/**
 * Whether a tank has a History tab. True for any tracked tank: one with a
 * baseline snapshot always has at least a lifecycle line (its introduction
 * version, or "introduced before our tracking started" when it predates the
 * window), and a changed tank has both. Only a tank we have never snapshotted
 * (unresolved / off-catalogue) has nothing to show.
 */
export async function getTankHasHistory(tankId: number): Promise<boolean> {
  const [row] = await db
    .select({
      has: sql<boolean>`
        exists(select 1 from ${tankSpecSnapshots} where ${tankSpecSnapshots.tankId} = ${tankId})
        or exists(select 1 from ${tankChanges} where ${tankChanges.tankId} = ${tankId})
      `,
    })
    .from(sql`(select 1) as _`);
  return row?.has ?? false;
}

export type SpecChange = {
  field: string;
  previous: number | null;
  next: number | null;
};
