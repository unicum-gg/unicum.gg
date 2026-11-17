import { sql } from "drizzle-orm";
import { playerSnapshotsByRegion, playersByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import {
  type WindowRecomputeTarget,
  loadRatingContext,
  recomputeWindowFigures,
} from "./window-ratings-backfill";

/**
 * Daily, just after midnight UTC: the quietest hour of the three regions'
 * evenings, and clear of the nightly by-tank walk at 03:30, which reads the
 * same `*_tank_snapshots` this does.
 */
const SCHEDULE = "10 0 * * *";

/**
 * Wider than the day between two ticks, so a tick that starts a few minutes
 * late does not miss the snapshots that crossed in between. The overlap only
 * costs a few accounts recomputed twice.
 */
const BAND = "26 hours";

const BATCH = 200;

/** Low on purpose: this is background upkeep beside the snapshot pipeline. */
const CONCURRENCY = 4;

export function startWindowRatingsRefreshCron(): void {
  for (const region of REGIONS) {
    const name = `window-ratings-refresh-cron-${region}`;
    if (scheduleCron(name, SCHEDULE, () => refreshWindowRatings(region))) {
      console.log(`[${name}] scheduled (${SCHEDULE})`);
    }
  }
}

/**
 * The accounts whose stored window figures time has made wrong since the last
 * tick.
 *
 * The 24h/7d/30d columns are computed when a snapshot is written, so they
 * describe the window as it stood at the account's last battle. Once one of the
 * snapshots inside a window ages past its edge, the window's baseline moves and
 * the stored figure still counts the battles before it: an account idle for ten
 * days shows its 30-day figure as of ten days ago. That happens exactly when a
 * snapshot's age crosses 24 hours, 7 days or 30 days, so those are the accounts
 * selected, and only when the crossing came after their last battle (an account
 * that played since was computed with the snapshot already outside).
 *
 * One sequential scan of `*_player_snapshots` (there is no index on `taken_at`
 * alone, ~60s on EU), since probing it per account would be two million index
 * lookups.
 */
export async function findMovedWindows(region: Region): Promise<WindowRecomputeTarget[]> {
  const players = playersByRegion[region];
  const snapshots = playerSnapshotsByRegion[region];
  const crossed = (window: string) => sql`(
    s.taken_at >= now() - interval '${sql.raw(window)}' - interval '${sql.raw(BAND)}'
    AND s.taken_at < now() - interval '${sql.raw(window)}'
    AND p.last_battle_at < s.taken_at + interval '${sql.raw(window)}'
  )`;
  const rows = await db.execute<{ id: number; account_id: string; last_battle_at: string | null }>(sql`
    SELECT DISTINCT p.id, p.account_id, p.last_battle_at
    FROM ${snapshots} s
    JOIN ${players} p ON p.id = s.player_id
    WHERE p.soft_deleted_at IS NULL
      AND s.taken_at >= now() - interval '30 days' - interval '${sql.raw(BAND)}'
      AND (${crossed("1 day")} OR ${crossed("7 days")} OR ${crossed("30 days")})
    ORDER BY p.id
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    accountId: Number(r.account_id),
    lastBattleAt: r.last_battle_at ? new Date(r.last_battle_at) : null,
  }));
}

/**
 * Recompute the window figures of every account `findMovedWindows` selects,
 * through the backfill's own recompute, so the snapshot path, the backfill and
 * this pass cannot write a window three ways. A tick the worker misses leaves
 * that day's crossings for the account's next battle.
 */
export async function refreshWindowRatings(region: Region): Promise<void> {
  const at = Date.now();
  const targets = await findMovedWindows(region);
  if (targets.length === 0) return;
  const selectedIn = Date.now() - at;
  const ctx = await loadRatingContext(region);
  let written = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    written += await recomputeWindowFigures(
      region,
      targets.slice(i, i + BATCH),
      ctx,
      CONCURRENCY,
    );
  }
  console.log(
    `[window-ratings-refresh] ${region}: ${written}/${targets.length} accounts recomputed ` +
      `(selected in ${Math.round(selectedIn / 1000)}s, ${Math.round((Date.now() - at) / 1000)}s total)`,
  );
}
