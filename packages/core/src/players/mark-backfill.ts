import {
  buildPlayerMarkCounts,
  MARKS_MIN_BATTLES,
  type PlayerMarkCounts,
} from "@unicum.gg/shared";
import { pgClient } from "@unicum.gg/core/db";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import type { Region } from "@unicum.gg/wargaming";
import { writePlayerMarkCountsBatch } from "./mark-counts";

/**
 * Seed `*_player_marks` from the marks already sitting in the snapshots.
 *
 * From here on the portal refresh is the only writer, but it only ever runs for
 * an account somebody looks up, so without this pass the board would start
 * empty and spend weeks publishing a top that was really a list of whoever had
 * been searched for recently. The marks we need are already stored: every
 * on-demand refresh since the feature shipped wrote them onto that cycle's tank
 * snapshots, and the bulk pipeline carries the last known value forward, so the
 * newest row of a (player, vehicle) run holds the newest marks we ever read.
 *
 * Deliberate rather than a cron, and run by a person: measured on EU it is
 * about 86 seconds per three thousand accounts over 1.6 million of them, so
 * roughly thirteen hours of walking per region. That is the same class of job
 * as `enumerate-tournaments` and is resumable the same way, by `--from`.
 *
 * The fold is `buildPlayerMarkCounts`, the very function the live writer uses.
 * That is the point of doing it in TypeScript rather than as one big
 * `INSERT ... SELECT`: a second, SQL-shaped definition of how a garage becomes
 * counts is a second answer waiting to disagree with the first.
 */

/** Accounts per pass. Sized from the measurement above: large enough that the
 * per-chunk planning and round trip disappear against the heap reads, small
 * enough that an interrupted run loses a minute rather than an hour. */
const CHUNK = 2000;

export type MarkBackfillProgress = {
  /** The highest `players.id` this chunk covered, which is what `--from`
   * resumes at. */
  cursor: number;
  examined: number;
  /** Accounts that had any marks stored, so a row was written. */
  written: number;
  withThreeMarks: number;
};

export type MarkBackfillOptions = {
  /** Resume point: only accounts with a higher `players.id`. */
  from?: number;
  /** Stop after this many accounts have been examined. */
  limit?: number;
  onProgress?: (p: MarkBackfillProgress) => void;
};

type SnapshotRow = {
  player_id: number;
  account_id: number;
  tank_id: number;
  marks_on_gun: number;
  taken_at: Date;
};

export async function backfillPlayerMarks(
  region: Region,
  { from = 0, limit, onProgress }: MarkBackfillOptions = {},
): Promise<MarkBackfillProgress> {
  const encyclopedia = await getVehicleEncyclopedia(region);
  const tierOf = (tankId: number): number | null => {
    const meta = encyclopedia[String(tankId)];
    return meta ? meta.tier : null;
  };

  const players = `${region}_players`;
  const snapshots = `${region}_tank_snapshots`;

  const total: MarkBackfillProgress = {
    cursor: from,
    examined: 0,
    written: 0,
    withThreeMarks: 0,
  };

  // One reserved connection for the whole run, with the same planner hints the
  // nightly by-tank walk needs and for the same reason: without them Postgres
  // picks a bitmap or sequential plan over a 411-million-row table and sorts
  // the result, which spills tens of gigabytes to pgsql_tmp. The chunk's
  // `player_id` range is served exactly by the (player_id, tank_id, battles)
  // primary key, so the ordered index scan needs no sort at all.
  const conn = await pgClient.reserve();
  try {
    await conn`SET enable_seqscan = off`;
    await conn`SET enable_bitmapscan = off`;
    await conn`SET jit = off`;

    for (;;) {
      if (limit != null && total.examined >= limit) break;
      const take =
        limit != null ? Math.min(CHUNK, limit - total.examined) : CHUNK;

      const ids = (await conn`
        SELECT id, account_id, battles
        FROM ${conn(players)}
        WHERE id > ${total.cursor}
          AND battles >= ${MARKS_MIN_BATTLES}
          AND soft_deleted_at IS NULL
        ORDER BY id
        LIMIT ${take}
      `) as unknown as Array<{
        id: number;
        account_id: number;
        battles: number;
      }>;
      if (ids.length === 0) break;

      const playerIds = ids.map((r) => r.id);
      const battlesByAccount = new Map(
        ids.map((r) => [Number(r.account_id), Number(r.battles)]),
      );
      // `marks_on_gun IS NOT NULL` is both the filter and the definition of
      // "latest": the bulk pipeline carries the last known marks forward, so
      // the newest row carrying a value is the newest reading we ever took, and
      // a null is a snapshot from before we had any. Taking the newest row
      // overall instead would answer null for every account whose last refresh
      // happened to skip the portal.
      const rows = (await conn`
        SELECT DISTINCT ON (s.player_id, s.tank_id)
          s.player_id, p.account_id, s.tank_id, s.marks_on_gun, s.taken_at
        FROM ${conn(snapshots)} s
        INNER JOIN ${conn(players)} p ON p.id = s.player_id
        WHERE s.player_id = ANY(${playerIds})
          AND s.marks_on_gun IS NOT NULL
        ORDER BY s.player_id, s.tank_id, s.battles DESC
      `) as unknown as SnapshotRow[];

      const perAccount = new Map<
        number,
        { marks: Map<number, number>; measuredAt: Date }
      >();
      for (const row of rows) {
        const accountId = Number(row.account_id);
        let entry = perAccount.get(accountId);
        if (!entry) {
          entry = { marks: new Map(), measuredAt: new Date(0) };
          perAccount.set(accountId, entry);
        }
        entry.marks.set(Number(row.tank_id), Number(row.marks_on_gun));
        // The garage was not read in one instant here (it is reassembled from
        // whatever rows survived), so the stamp is the NEWEST observation in
        // it. That is an upper bound rather than the live writer's exact
        // stamp: the bulk pipeline carries the last known marks forward onto
        // newer snapshots without re-reading them, and a carried value is
        // identical to a re-confirmed one in the stored rows, so the two
        // cannot be told apart. The column says so, and the next on-demand
        // refresh of the account replaces the bound with the real thing.
        const takenAt = new Date(row.taken_at);
        if (takenAt > entry.measuredAt) entry.measuredAt = takenAt;
      }

      const batch: Array<{
        accountId: number;
        counts: PlayerMarkCounts;
        battles: number;
        measuredAt: Date;
      }> = [];
      for (const [accountId, entry] of perAccount) {
        const counts = buildPlayerMarkCounts(entry.marks, tierOf);
        // An account whose every marked vehicle is missing from the catalogue
        // folds to nothing, and a row of zeroes would claim we read a garage
        // and found no marks in it.
        if (counts.known === 0) continue;
        batch.push({
          accountId,
          counts,
          // Today's count rather than the one at the moment of the reading,
          // which is not recoverable here. It only decides eligibility against
          // a floor of a thousand, and today's is the figure the board's own
          // predicate would have used anyway.
          battles: battlesByAccount.get(accountId) ?? 0,
          measuredAt: entry.measuredAt,
        });
        if (counts.mark3.total > 0) total.withThreeMarks += 1;
      }
      total.written += await writePlayerMarkCountsBatch(region, batch);

      total.examined += ids.length;
      total.cursor = playerIds[playerIds.length - 1];
      onProgress?.({ ...total });

      // A short page means the ordered scan reached the end of the table.
      if (ids.length < take) break;
    }
  } finally {
    // Hand the connection back the way the by-tank cron does: postgres.js
    // issues no DISCARD on release, so a pooled connection would keep both scan
    // types off for the rest of its life and every later query that round-robins
    // onto it would be forced onto an index plan.
    try {
      await conn`RESET enable_seqscan`;
      await conn`RESET enable_bitmapscan`;
      await conn`RESET jit`;
    } catch {
      // A connection that died mid-run cannot be reset and is discarded anyway.
      // Swallowing it keeps the real error visible.
    } finally {
      conn.release();
    }
  }

  return total;
}
