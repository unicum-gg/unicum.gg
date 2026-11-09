import { sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import { battlesByRegion, type NewBattleRow } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * Writing down the battles players' own clients report.
 *
 * Wargaming's API publishes an account's running totals and nothing about a
 * single battle: who was in it, what each of them did, which map, which
 * cluster. So a battle here exists only because somebody running the mod was
 * in it, and this module is the whole of that write path.
 *
 * **One battle reaches us from any participant, and names all thirty.** That
 * is the shape of this: `arena_unique_id` is a deduplication key, not an
 * ownership one. Two of our players in the same battle send the same battle,
 * and coverage grows by whole teams rather than one player at a time. The
 * first of them to arrive is the row we keep, because both read the same
 * server-side results and there is nothing to choose between them; the second
 * still adds itself to `reported_by`, so the row knows it was seen twice.
 *
 * **Everything here answers by name, never by count.** A count cannot be
 * acted on: the mod's queue is the only copy of a battle it has not yet
 * placed, and "three were accepted" does not say which three, so the only
 * safe thing it could do with a count is drop everything or nothing. Both are
 * wrong. Every battle that comes back named is one the mod may forget, and
 * anything unnamed is one it must keep.
 */

/** How many battles one request may carry. A night of play is a few dozen. */
export const MAX_BATTLES_PER_UPLOAD = 25;

export type BattleIngestResult = {
  /** Battles written by this call, by id. */
  stored: string[];
  /** Battles another client had already sent, by id. Expected, not an error. */
  known: string[];
  /**
   * Battles the database refused, by id and reason.
   *
   * Named individually because the alternative is what the first version did:
   * one statement, so one bad row lost the other twenty-four and the mod
   * retried the same batch for ever.
   */
  failed: { arenaUniqueId: string; reason: string }[];
};

/**
 * A day ahead, for the gap between Wargaming's clock and ours.
 *
 * `started_at` comes from the battle's server-side `arenaCreateTime`, so a
 * player's own clock cannot move it, and this is only here to catch nonsense.
 */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** The months a region's table holds, as a half-open `[from, to)`. */
type PartitionRange = { from: Date; to: Date };

/** How long the partition list is reused before Postgres is asked again. */
const PARTITIONS_TTL_MS = 10 * 60 * 1000;

const partitionsByRegion = new Map<
  Region,
  { range: PartitionRange | null; at: number }
>();

function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

/**
 * The months this region's table has a partition for, asked of Postgres.
 *
 * Read from the partition NAMES, which carry the month
 * (`eu_battles_2026_09`), rather than from `relpartbound`. The DEFAULT
 * partition's name does not match, and that is the point: it is the one
 * partition nothing may rely on, since a row landing there blocks ATTACH of
 * the month it belonged to, which is why `battles_partition_gap` exists.
 *
 * Cached, because the answer changes only when a migration runs while the
 * question is asked once per battle a client reports.
 */
async function partitionRange(region: Region): Promise<PartitionRange | null> {
  const held = partitionsByRegion.get(region);
  if (held && Date.now() - held.at < PARTITIONS_TTL_MS) return held.range;
  const rows = (await db.execute(sql`
    SELECT child.relname AS name
    FROM pg_inherits
    JOIN pg_class AS child ON child.oid = pg_inherits.inhrelid
    JOIN pg_class AS parent ON parent.oid = pg_inherits.inhparent
    WHERE parent.relname = ${`${region}_battles`}
  `)) as unknown as Array<{ name: string }>;
  const months: Array<[number, number]> = [];
  for (const row of rows) {
    const named = /_(\d{4})_(\d{2})$/.exec(row.name);
    if (named) months.push([Number(named[1]), Number(named[2]) - 1]);
  }
  months.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const first = months[0];
  const last = months[months.length - 1];
  const range =
    first && last
      ? {
          from: monthStart(first[0], first[1]),
          to: monthStart(last[0], last[1] + 1),
        }
      : null;
  partitionsByRegion.set(region, { range, at: Date.now() });
  return range;
}

/**
 * Whether this battle's start falls inside the months the table holds.
 *
 * The months are read from the table, and that reading is the whole of this
 * function's history. It used to mirror the migration's own
 * `date_trunc('month', now()) - interval '1 month'`
 * (`drizzle/0120_battles.sql`), which the migration evaluates ONCE when it is
 * applied while this evaluated it on every request, so the two drift apart by
 * a month for every month that passes. Measured on 2026-11-09 against
 * partitions starting at 2026-09: every battle from September was refused as
 * `too_old` for a month whose partition sat there empty, and one player's
 * replay folder alone held 1,159 of them.
 *
 * The concern that put the mirror there stands, and is answered: nothing here
 * lets a client's date make the database find room for it. The client names a
 * date, this asks which months exist, and a date outside them is refused.
 * Creating a partition stays a migration we write.
 *
 * Fails open when no month-named partition is found at all. The table is then
 * not in the shape this expects, and refusing every battle would stop the
 * whole write path over one introspection query; the DEFAULT partition keeps
 * the row and the gap view reports it.
 */
export async function startsInRange(
  region: Region,
  startedAt: Date,
  now: Date = new Date(),
): Promise<boolean> {
  const at = startedAt.getTime();
  if (!Number.isFinite(at)) return false;
  if (at > now.getTime() + FUTURE_TOLERANCE_MS) return false;
  const range = await partitionRange(region);
  if (!range) return true;
  return at >= range.from.getTime() && at < range.to.getTime();
}

/**
 * The game's battle id as the one string that means this battle.
 *
 * The column is text, so `0123` and `123` would be two different battles for
 * one id, and twenty padded variants would store the same battle twenty
 * times. Stripping the padding here rather than refusing it keeps an honest
 * client that pads from being refused, and takes the trick away from one that
 * pads on purpose.
 */
export function normaliseBattleId(id: string): string {
  const stripped = id.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

/**
 * Store these battles, naming what happened to each.
 *
 * `onConflictDoUpdate` rather than `DoNothing`, and the only thing it updates
 * is `reported_by`: the two senders of one battle are reporting the same
 * server-side results, so there is no newer version to prefer, but the fact
 * that a second client saw it is new and worth keeping.
 *
 * `stored` and `known` are told apart by `created_at`, which this call sets to
 * one stamp of its own and the conflict path does not touch: a row that comes
 * back carrying that stamp is one this statement inserted, and any other value
 * is a row that was already there. The usual trick for this is `xmax = 0` in
 * `RETURNING`, and it does not work here: on a partitioned table the returned
 * tuple is a virtual slot, so Postgres refuses to read a system attribute off
 * it (`0A000`, `tts_virtual_getsysattr`). The stamp needs no system column and
 * is exact.
 *
 * The conflict target is `(started_at, arena_unique_id)` because the table is
 * partitioned on the first of those, which Postgres requires inside every
 * unique constraint.
 *
 * One statement for the batch, and **row by row if that statement fails**. A
 * single unstorable row used to abort the other twenty-four, answer 502, and
 * leave the mod retrying the identical batch until its queue overflowed. Now
 * the good rows go in and the bad ones come back named, which is the only
 * answer the mod can act on.
 */
export async function recordBattles(
  region: Region,
  battles: NewBattleRow[],
): Promise<BattleIngestResult> {
  const unique = new Map(
    battles.map((battle) => [battle.arenaUniqueId, battle]),
  );
  const rows = [...unique.values()];
  if (rows.length === 0) return { stored: [], known: [], failed: [] };
  try {
    return { ...(await insert(region, rows)), failed: [] };
  } catch (error) {
    console.error(
      `[battles] ${region}: a batch of ${rows.length} failed, falling back to one at a time:`,
      error,
    );
    return oneAtATime(region, rows);
  }
}

type Placed = { stored: string[]; known: string[] };

async function insert(region: Region, rows: NewBattleRow[]): Promise<Placed> {
  const table = battlesByRegion[region];
  // One stamp for the whole statement, so a row that comes back with it is one
  // this statement inserted. See the note above on why not `xmax`.
  const stamp = new Date();
  const written = await db
    .insert(table)
    .values(rows.map((row) => ({ ...row, createdAt: stamp })))
    .onConflictDoUpdate({
      target: [table.startedAt, table.arenaUniqueId],
      // Appended, not replaced, and only when it is not already there: a
      // client that resends a battle it already reported must not make the
      // array grow for ever. `created_at` is deliberately absent, which is
      // what makes the stamp readable as "this statement inserted it".
      set: {
        reportedBy: sql`CASE WHEN ${table.reportedBy} @> excluded.reported_by
                             THEN ${table.reportedBy}
                             ELSE ${table.reportedBy} || excluded.reported_by END`,
      },
    })
    .returning({
      arenaUniqueId: table.arenaUniqueId,
      createdAt: table.createdAt,
    });
  const stored: string[] = [];
  const known: string[] = [];
  for (const row of written) {
    const fresh = row.createdAt.getTime() === stamp.getTime();
    (fresh ? stored : known).push(row.arenaUniqueId);
  }
  return { stored, known };
}

/** The slow path, taken only after a batch has already failed. */
async function oneAtATime(
  region: Region,
  rows: NewBattleRow[],
): Promise<BattleIngestResult> {
  const stored: string[] = [];
  const known: string[] = [];
  const failed: BattleIngestResult["failed"] = [];
  for (const row of rows) {
    try {
      const placed = await insert(region, [row]);
      stored.push(...placed.stored);
      known.push(...placed.known);
    } catch (error) {
      failed.push({
        arenaUniqueId: row.arenaUniqueId,
        // The message, not the whole error: it reaches a game client, and the
        // client's only use for it is a log line a player might send us.
        reason: shortReason(error),
      });
      console.error(
        `[battles] ${region}: battle ${row.arenaUniqueId} refused by the database:`,
        error,
      );
    }
  }
  return { stored, known, failed };
}

function shortReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0].slice(0, 120);
}
