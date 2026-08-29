import { and, asc, desc, eq, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  type ClanPeriodBaseline,
  type ClanSnapshot,
  clanSnapshotsByRegion,
  clansByRegion,
  type ClanSnapshotPeriods,
  strongholdDueAtFor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { ClanGlobalMapData } from "@unicum.gg/core/wargaming/wot/clans/globalmap";
import type { ClanStrongholdData } from "@unicum.gg/core/wargaming/wot/clans/stronghold";

// Floor between two stored snapshots for one clan. This is NOT the sampling
// cadence, that lives in `clans/stronghold-policy` and is carried by
// `clans.stronghold_due_at`. It only stops the on-demand path (a page hit
// enqueues a clan refresh, which fetches the Stronghold too) from stacking
// near-identical rows when a clan is being viewed repeatedly.
//
// It used to be 24h, which silently capped the whole system: a "Last 24h"
// column needs a baseline INSIDE the 24h window, and a 24h floor guarantees the
// closest one sits exactly on or beyond the edge.
const SNAPSHOT_MIN_INTERVAL_MS = 60 * 60 * 1000;

/** The Stronghold half of a snapshot row, flattened to its columns. */
function strongholdColumns(data: ClanStrongholdData) {
  return {
    eloT6: data.t6?.elo ?? null,
    skirmishBattlesT6: data.t6?.skirmish?.battles ?? null,
    skirmishWinsT6: data.t6?.skirmish?.wins ?? null,
    eloT8: data.t8?.elo ?? null,
    skirmishBattlesT8: data.t8?.skirmish?.battles ?? null,
    skirmishWinsT8: data.t8?.skirmish?.wins ?? null,
    eloT10: data.t10?.elo ?? null,
    skirmishBattlesT10: data.t10?.skirmish?.battles ?? null,
    skirmishWinsT10: data.t10?.skirmish?.wins ?? null,
    advancesBattlesT10: data.t10?.advances?.battles ?? null,
    advancesWinsT10: data.t10?.advances?.wins ?? null,
  };
}

/** The Global Map half, flattened to its columns. */
function globalMapColumns(gm: ClanGlobalMapData) {
  return {
    gmEloT10: gm.eloT10,
    gmBattlesT10: gm.battlesT10,
    gmWinsT10: gm.winsT10,
    gmEloT8: gm.eloT8,
    gmBattlesT8: gm.battlesT8,
    gmWinsT8: gm.winsT8,
    gmEloT6: gm.eloT6,
    gmBattlesT6: gm.battlesT6,
    gmWinsT6: gm.winsT6,
    gmProvinces: gm.provinces,
  };
}

/** Either half read back off an existing row, so the writer of one half can
 * carry the other forward instead of nulling it. */
function carriedStronghold(row: ClanSnapshot | undefined) {
  return {
    eloT6: row?.eloT6 ?? null,
    skirmishBattlesT6: row?.skirmishBattlesT6 ?? null,
    skirmishWinsT6: row?.skirmishWinsT6 ?? null,
    eloT8: row?.eloT8 ?? null,
    skirmishBattlesT8: row?.skirmishBattlesT8 ?? null,
    skirmishWinsT8: row?.skirmishWinsT8 ?? null,
    eloT10: row?.eloT10 ?? null,
    skirmishBattlesT10: row?.skirmishBattlesT10 ?? null,
    skirmishWinsT10: row?.skirmishWinsT10 ?? null,
    advancesBattlesT10: row?.advancesBattlesT10 ?? null,
    advancesWinsT10: row?.advancesWinsT10 ?? null,
  };
}

function carriedGlobalMap(row: ClanSnapshot | undefined) {
  return {
    gmEloT10: row?.gmEloT10 ?? null,
    gmBattlesT10: row?.gmBattlesT10 ?? null,
    gmWinsT10: row?.gmWinsT10 ?? null,
    gmEloT8: row?.gmEloT8 ?? null,
    gmBattlesT8: row?.gmBattlesT8 ?? null,
    gmWinsT8: row?.gmWinsT8 ?? null,
    gmEloT6: row?.gmEloT6 ?? null,
    gmBattlesT6: row?.gmBattlesT6 ?? null,
    gmWinsT6: row?.gmWinsT6 ?? null,
    gmProvinces: row?.gmProvinces ?? null,
  };
}

function latestSnapshot(
  region: Region,
  clanId: number,
): Promise<ClanSnapshot | undefined> {
  const snapshots = clanSnapshotsByRegion[region];
  return db
    .select()
    .from(snapshots)
    .where(eq(snapshots.clanId, clanId))
    .orderBy(desc(snapshots.takenAt))
    .limit(1)
    .then((rows) => rows[0]);
}

/**
 * Store one Stronghold sample and schedule the next one.
 *
 * `data` is null when the clan has no Stronghold (the host's 404). That is a
 * real answer, so it still counts as a successful sample: no row is written, but
 * the clan is pushed out to its bucket's cadence. Without that, the ~57% of
 * clans with no fort would stay permanently due and the cron would spin on them
 * forever instead of reaching the ones that play.
 *
 * A row holds the Global Map half too, but that half is now fetched by a
 * different cron on a different budget, so it is carried forward from the
 * previous row rather than written as null, otherwise every Stronghold sample
 * would blank the clan-wars view until the next full clan refresh.
 */
export async function recordClanSnapshot(
  region: Region,
  clanId: number,
  data: ClanStrongholdData | null,
): Promise<void> {
  const snapshots = clanSnapshotsByRegion[region];
  const clans = clansByRegion[region];

  // Scheduled from what WG just told us about this clan's activity, whether or
  // not we end up storing a row: we paid for the fetch either way, so the next
  // one is due a full cadence out.
  await db
    .update(clans)
    .set({ strongholdDueAt: strongholdDueAtFor(data) })
    .where(eq(clans.id, clanId));

  if (!data) return;

  const latest = await latestSnapshot(region, clanId);
  if (
    latest &&
    Date.now() - latest.takenAt.getTime() < SNAPSHOT_MIN_INTERVAL_MS
  ) {
    return;
  }

  await db.insert(snapshots).values({
    clanId,
    ...strongholdColumns(data),
    ...carriedGlobalMap(latest),
  });
}

/**
 * Store one Global Map sample, carrying the Stronghold half of the row forward.
 *
 * Only writes when the figures actually moved. Global Map is a seasonal event
 * mode that the overwhelming majority of clans never enter, so an unconditional
 * write would add a row per clan per backfill pass, tens of thousands a day,
 * to say nothing changed, on a table the Stronghold cron is already writing to
 * far more often. When it does move, a dated row is exactly what the clan-wars
 * period columns need, so those are kept.
 */
export async function recordClanGlobalMapSnapshot(
  region: Region,
  clanId: number,
  gm: ClanGlobalMapData,
): Promise<void> {
  const snapshots = clanSnapshotsByRegion[region];
  const latest = await latestSnapshot(region, clanId);
  const next = globalMapColumns(gm);
  if (latest) {
    const current = carriedGlobalMap(latest);
    const unchanged = (
      Object.keys(next) as Array<keyof typeof next>
    ).every((k) => current[k] === next[k]);
    if (unchanged) return;
  }
  await db.insert(snapshots).values({
    clanId,
    ...carriedStronghold(latest),
    ...next,
  });
}

export async function getClanSnapshotPeriods(
  region: Region,
  clanId: number,
): Promise<ClanSnapshotPeriods> {
  const snapshots = clanSnapshotsByRegion[region];
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const windows = { h24: 24 * HOUR, d7: 7 * 24 * HOUR, d30: 30 * 24 * HOUR };

  // The current snapshot's timestamp. We exclude it from the short-history
  // fallback below so a clan with a single snapshot stays empty rather than
  // diffing against itself.
  const [latest] = await db
    .select({ takenAt: snapshots.takenAt })
    .from(snapshots)
    .where(eq(snapshots.clanId, clanId))
    .orderBy(desc(snapshots.takenAt))
    .limit(1);
  const latestTakenAt = latest?.takenAt ?? null;

  /**
   * Baseline snapshot for a period diff: normally the newest snapshot at or
   * before `cutoff`. When the clan has been tracked for less than that window,
   * no such snapshot exists, so fall back to the oldest snapshot other than the
   * current one, otherwise a recently-tracked clan shows a blank period column
   * instead of the games it actually played.
   *
   * `attributable` says whether a NON-ZERO delta measured from this baseline can
   * honestly be labelled with this window. The diff spans
   * [baseline, latest], which is wider than [cutoff, latest] by however far the
   * baseline predates the cutoff, so anything the clan did in that overhang gets
   * counted into the wrong column. Sampling used to be sparse enough that this
   * was the normal case, not the edge one: the "Last 24h" baseline was a median
   * of NINE DAYS old, and "Last 7d" ten, which is why the two columns showed the
   * same number for most clans.
   *
   * A zero delta needs no such guard, and that is not an approximation: battles
   * and wins are monotonic counters, so baseline <= cutoff <= latest means
   * 0 = latest - baseline >= latest - cutoff >= 0. The window being too wide
   * cannot hide activity inside it. That is what keeps an idle clan reading a
   * truthful "0" rather than an evasive dash.
   */
  async function periodBaseline(
    windowMs: number,
  ): Promise<ClanPeriodBaseline | null> {
    if (!latestTakenAt) return null;
    const cutoff = new Date(now - windowMs);
    // A raw `sql` template can't bind a Date directly (the driver only accepts
    // strings/buffers there), so hand it the ISO string cast to timestamptz.
    const cutoffTs = sql`${cutoff.toISOString()}::timestamptz`;
    const [row] = await db
      .select()
      .from(snapshots)
      .where(
        and(
          eq(snapshots.clanId, clanId),
          or(
            lte(snapshots.takenAt, cutoff),
            lt(snapshots.takenAt, latestTakenAt),
          ),
        ),
      )
      .orderBy(
        sql`(${snapshots.takenAt} <= ${cutoffTs}) DESC`,
        sql`CASE WHEN ${snapshots.takenAt} <= ${cutoffTs} THEN ${snapshots.takenAt} END DESC`,
        asc(snapshots.takenAt),
      )
      .limit(1);
    if (!row) return null;
    // One window of slack: the measured span may reach twice the label before a
    // non-zero delta stops being attributable. A baseline NEWER than the cutoff
    // (the short-history fallback) passes trivially, it narrows the span rather
    // than widening it, so it can only under-report, which is the whole point of
    // that fallback.
    const attributable = row.takenAt.getTime() >= now - 2 * windowMs;
    return { snapshot: row, attributable };
  }

  const [h24, d7, d30] = await Promise.all([
    periodBaseline(windows.h24),
    periodBaseline(windows.d7),
    periodBaseline(windows.d30),
  ]);

  return { h24, d7, d30 };
}

export async function getLatestClanSnapshot(
  region: Region,
  clanId: number,
): Promise<ClanSnapshot | null> {
  const snapshots = clanSnapshotsByRegion[region];
  const [row] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.clanId, clanId))
    .orderBy(desc(snapshots.takenAt))
    .limit(1);
  return row ?? null;
}
