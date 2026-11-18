import { eq, sql } from "drizzle-orm";
import {
  playerSnapshotsByRegion,
  playersByRegion,
  windowRefreshState,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import {
  type WindowRecomputeTarget,
  loadRatingContext,
  recomputeWindowFigures,
} from "./window-ratings-backfill";

/**
 * Hourly, on a minute none of the hourly recomputes hold. Small slices rather
 * than one nightly pass: EU has about 230,000 accounts a day to recompute at
 * under ten a second, and a worker redeploy (several a day) killed the nightly
 * pass a third of the way through on its first night. Each tick resumes from
 * the stored mark, so a redeploy now costs one batch.
 */
const SCHEDULE = "25 * * * *";

/** Stops starting batches after this, so a tick never runs into the next. */
const TICK_BUDGET_MS = 40 * 60 * 1000;

/** At most this much of the crossing timeline per selection, which bounds the
 * selection while a backlog is being caught up. */
const SLICE_MS = 6 * 60 * 60 * 1000;

/** Fallback start for a region with no stored mark yet. */
const FIRST_RUN_LOOKBACK_MS = 60 * 60 * 1000;

const BATCH = 200;

/** The work is latency-bound (a handful of small indexed queries per account),
 * so this is what sets the pace, not what loads the database. */
const CONCURRENCY = 8;

const WINDOWS = ["1 day", "7 days", "30 days"] as const;

type Crossing = WindowRecomputeTarget & { crossedAt: Date };

export function startWindowRatingsRefreshCron(): void {
  for (const region of REGIONS) {
    const name = `window-ratings-refresh-cron-${region}`;
    if (scheduleCron(name, SCHEDULE, () => refreshWindowRatings(region))) {
      console.log(`[${name}] scheduled (${SCHEDULE})`);
    }
  }
}

/**
 * The accounts whose stored window figures time made wrong in `(from, to]`.
 *
 * The 24h/7d/30d columns are computed when a snapshot is written, so they
 * describe the window as it stood then. Once a snapshot ages past a window's
 * edge, the window's baseline moves and the stored figure still counts the
 * battles before it: an account idle for ten days shows its 30-day figure as of
 * ten days ago. So an account is selected at the instant one of its snapshots
 * turns 24 hours, 7 days or 30 days old, unless it has a snapshot from that
 * instant on, which the snapshot path already computed with the old one
 * outside. Ordered by that instant, so a tick that stops early can store how
 * far it got.
 */
export async function findWindowCrossings(
  region: Region,
  from: Date,
  to: Date,
): Promise<Crossing[]> {
  const players = playersByRegion[region];
  const snapshots = playerSnapshotsByRegion[region];
  const lo = from.toISOString();
  const hi = to.toISOString();
  const bands = sql.join(
    WINDOWS.map(
      (w) => sql`
        SELECT s.player_id, s.taken_at + interval '${sql.raw(w)}' AS crossed_at
        FROM ${snapshots} s
        WHERE s.taken_at > ${lo}::timestamptz - interval '${sql.raw(w)}'
          AND s.taken_at <= ${hi}::timestamptz - interval '${sql.raw(w)}'`,
    ),
    sql` UNION ALL `,
  );
  const rows = await db.execute<{
    id: number;
    account_id: string;
    last_battle_at: string | null;
    crossed_at: string;
  }>(sql`
    WITH crossings AS (${bands}),
    stale AS (
      SELECT c.player_id, min(c.crossed_at) AS crossed_at
      FROM crossings c
      WHERE NOT EXISTS (
        SELECT 1 FROM ${snapshots} s2
        WHERE s2.player_id = c.player_id AND s2.taken_at >= c.crossed_at
      )
      GROUP BY c.player_id
    )
    SELECT p.id, p.account_id, p.last_battle_at, stale.crossed_at
    FROM stale
    JOIN ${players} p ON p.id = stale.player_id
    WHERE p.soft_deleted_at IS NULL
    ORDER BY stale.crossed_at, p.id
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    accountId: Number(r.account_id),
    lastBattleAt: r.last_battle_at ? new Date(r.last_battle_at) : null,
    crossedAt: new Date(r.crossed_at),
  }));
}

async function readMark(region: Region): Promise<Date> {
  const [row] = await db
    .select({ processedUntil: windowRefreshState.processedUntil })
    .from(windowRefreshState)
    .where(eq(windowRefreshState.region, region));
  return row?.processedUntil ?? new Date(Date.now() - FIRST_RUN_LOOKBACK_MS);
}

async function writeMark(region: Region, processedUntil: Date): Promise<void> {
  await db
    .insert(windowRefreshState)
    .values({ region, processedUntil })
    .onConflictDoUpdate({
      target: windowRefreshState.region,
      set: { processedUntil, updatedAt: new Date() },
    });
}

/**
 * Recompute, through the backfill's own recompute (so the snapshot path, the
 * backfill and this pass cannot write a window three ways), every account
 * `findWindowCrossings` selects between the stored mark and now, advancing the
 * mark after each batch. A backlog is worked off a tick budget at a time.
 */
export async function refreshWindowRatings(region: Region): Promise<void> {
  const startedAt = Date.now();
  const ctx = await loadRatingContext(region);
  let mark = await readMark(region);
  // Fixed at the start, or a caught-up tick would chase the clock with ever
  // smaller selections.
  const end = new Date();
  let written = 0;
  let selected = 0;
  let outOfTime = false;
  while (!outOfTime) {
    const to = new Date(Math.min(end.getTime(), mark.getTime() + SLICE_MS));
    if (to <= mark) break;
    const crossings = await findWindowCrossings(region, mark, to);
    selected += crossings.length;
    let i = 0;
    for (; i < crossings.length; i += BATCH) {
      if (Date.now() - startedAt > TICK_BUDGET_MS) {
        outOfTime = true;
        break;
      }
      written += await recomputeWindowFigures(
        region,
        crossings.slice(i, i + BATCH),
        ctx,
        CONCURRENCY,
      );
      // Everything before the next unprocessed crossing is done. The mark is
      // exclusive, so step just short of it.
      const next = crossings[i + BATCH];
      mark = next ? new Date(next.crossedAt.getTime() - 1) : to;
      await writeMark(region, mark);
    }
    if (crossings.length === 0) {
      mark = to;
      await writeMark(region, mark);
    }
  }
  if (selected === 0) return;
  console.log(
    `[window-ratings-refresh] ${region}: ${written} accounts recomputed in ` +
      `${Math.round((Date.now() - startedAt) / 1000)}s, caught up to ${mark.toISOString()}` +
      (outOfTime ? " (tick budget reached, resuming next tick)" : ""),
  );
}
