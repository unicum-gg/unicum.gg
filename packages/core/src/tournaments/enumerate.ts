import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { tournamentsByRegion } from "@unicum.gg/shared";
import { TournamentApiError, type Region } from "@unicum.gg/wargaming";
import { mirrorTournament } from "./index";

/**
 * Mirrors the tournaments Wargaming still serves but no longer lists.
 *
 * The catalogue is not the archive, and on EU it is barely a sample of it. The
 * lobby endpoint reports 525 settled tournaments there, which is everything our
 * sweep can ever see, while the ids run from 5000000795 to 5000015165 and answer
 * individually across the whole range: 866 consecutive ids probed over 2026
 * returned 866 tournaments, none of them absent, of which the catalogue listed
 * 128. So roughly nine tournaments in ten exist, are complete, and are reachable
 * only by asking for them by id.
 *
 * That is a difference in kind rather than in degree, because the ids are
 * sequential per region and therefore enumerable: what the catalogue withholds
 * can be asked for directly. NA and Asia are mirrored almost entirely by the
 * catalogue already (3,384 of ~4,188 ids, 2,030 of ~3,107), so this pass is
 * where EU's history comes from.
 *
 * What comes back is the header and the ROSTERS, not the bracket. Wargaming
 * purges the bracket of a routine tournament within days of it being played, so
 * for anything this pass reaches there is none left upstream to recover, and it
 * would be wrong to describe the result as the tournament in full. The rosters
 * are the point regardless: they carry account ids, which is the join onto the
 * players and clans we already hold, and the only reason a tournament record
 * can hang off a player page at all.
 *
 * The pass is deliberate, not a cron: it is a walk of tens of thousands of ids
 * at the tournament pool's three requests a second, and nothing downstream is
 * waiting on it.
 */

export type EnumerateProgress = {
  region: Region;
  /** Ids asked for, whether or not they turned out to exist. */
  scanned: number;
  /** Tournaments found and mirrored that the catalogue never listed. */
  discovered: number;
  /** Ids the system answered NOT_FOUND for. */
  absent: number;
  /** Tournaments created but not scheduled yet, so not storable. */
  unscheduled: number;
  /** Ids that errored for any other reason, left for a later run. */
  failed: number;
  /** The id just handled, so an interrupted run can be resumed from it. */
  cursor: number;
};

export type EnumerateOptions = {
  /** Lowest id to probe. Defaults to the region's first possible id. */
  from?: number;
  /** Highest id to probe. Defaults to the newest id we already hold. */
  to?: number;
  /** Stop after this many ids have been probed. Omit to walk the range. */
  limit?: number;
  onProgress?: (progress: EnumerateProgress) => void;
};

export type EnumerateResult = Omit<EnumerateProgress, "cursor"> & {
  /** Where the walk stopped, which is where a resumed run should start. */
  cursor: number | null;
};

/**
 * The bounds of a region's id space, read from the rows we hold.
 *
 * The region lives in the id's leading digits (EU 5, NA 1, Asia 2), so the floor
 * is derived by truncating a known id rather than kept as a table of prefixes
 * that would have to be edited if Wargaming ever numbered a fourth realm.
 */
async function idRange(region: Region): Promise<{ base: number; max: number } | null> {
  const table = tournamentsByRegion[region];
  const [row] = await db
    .select({ max: sql<number>`max(${table.id})::bigint` })
    .from(table);
  const max = Number(row?.max ?? 0);
  if (!max) return null;
  return { base: Math.floor(max / 1_000_000_000) * 1_000_000_000, max };
}

/** Ids in the range whose bracket is already mirrored, so the walk skips them. */
async function mirroredIds(
  region: Region,
  from: number,
  to: number,
): Promise<Set<number>> {
  const table = tournamentsByRegion[region];
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(
      sql`${table.id} BETWEEN ${from} AND ${to} AND ${table.detailSyncedAt} IS NOT NULL`,
    );
  return new Set(rows.map((r) => Number(r.id)));
}

/**
 * Walk a region's id space, mirroring every tournament that answers.
 *
 * Newest first, so a run that is cut short has recovered the seasons players are
 * most likely to look up rather than 2016. Serial, like the backfill beside it,
 * because both draw on the same three-requests-a-second host pool and firing
 * several at once would only queue deeper on it.
 *
 * Safe to interrupt and re-run. Tournaments already mirrored are skipped, so a
 * second run resumes rather than restarts; ids that do not exist leave no trace
 * and are probed again, which costs one request each and is why the walk reports
 * its cursor rather than expecting to be run from scratch.
 */
/**
 * Whether the error means THIS id does not exist, rather than one of the
 * requests under it having failed.
 *
 * The distinction is the walk's whole safety margin, and a bare NOT_FOUND check
 * cannot make it: `mirrorTournament` reads the tournament, then its teams, then
 * its stages and everything under them, and the sub-resources answer NOT_FOUND
 * too (`/stages/` does, verified against the live host). Treating one of those
 * as "this id is a hole" would drop a real tournament, leave no trace of having
 * done so, since absent ids are not recorded anywhere, and drop it again on
 * every later run. So the path is checked: only the tournament's own record
 * saying NOT_FOUND means the id was never issued, and anything else is a
 * failure to retry.
 */
function isMissingTournament(err: unknown, tournamentId: number): boolean {
  return (
    err instanceof TournamentApiError &&
    err.code === "NOT_FOUND" &&
    err.path.endsWith(`/tournament/${tournamentId}/`)
  );
}

/**
 * How many failures in a row end the walk.
 *
 * Not a retry policy but a blast radius. A walk covers tens of thousands of ids
 * on a pool the live cron shares, so an upstream that starts refusing every
 * request (a Cloudflare block on the host, an outage) would otherwise keep
 * asking at three a second for hours, starving the cron behind it and logging
 * one error per id. Missing ids do not count: the sequence is full of holes and
 * meeting them is the job.
 */
const FAILURE_STREAK_LIMIT = 25;

export async function enumerateRegion(
  region: Region,
  { from, to, limit, onProgress }: EnumerateOptions = {},
): Promise<EnumerateResult> {
  const range = await idRange(region);
  if (!range) {
    return {
      region,
      scanned: 0,
      discovered: 0,
      absent: 0,
      unscheduled: 0,
      failed: 0,
      cursor: null,
    };
  }
  // Clamped to the region's own space rather than trusted. An id names its
  // region in its leading digits, so a cursor copied from another region's run
  // (an easy mistake: they look alike and the CLI takes them as plain numbers)
  // would otherwise ask this one to walk billions of ids that cannot exist,
  // every one of them a live request against a pool the live cron shares.
  const lo = Math.max(from ?? range.base + 1, range.base + 1);
  const hi = Math.min(to ?? range.max, range.max);
  const held = await mirroredIds(region, lo, hi);

  let scanned = 0;
  let discovered = 0;
  let absent = 0;
  let unscheduled = 0;
  let failed = 0;
  let streak = 0;
  let cursor: number | null = null;

  for (let id = hi; id >= lo; id--) {
    if (held.has(id)) continue;
    if (limit !== undefined && scanned >= limit) break;
    scanned += 1;
    cursor = id;
    try {
      // Null means the tournament exists but has no dates yet, so there is
      // nothing to store and nothing wrong: it arrives once it is scheduled.
      if (await mirrorTournament(region, id)) discovered += 1;
      else unscheduled += 1;
      streak = 0;
    } catch (err) {
      // The system answers 200 with NOT_FOUND for an id it never issued, which
      // is an answer rather than a failure: the sequence has holes and walking
      // it means meeting them. Anything else is left unstamped for a later run.
      if (isMissingTournament(err, id)) {
        absent += 1;
        streak = 0;
      } else {
        failed += 1;
        streak += 1;
        console.error(`[tournaments-enumerate-${region}] ${id} failed:`, err);
        if (streak >= FAILURE_STREAK_LIMIT) {
          console.error(
            `[tournaments-enumerate-${region}] stopping at ${id}: ` +
              `${streak} consecutive failures. Resume with --from 1 --to ${id}.`,
          );
          break;
        }
      }
    }
    onProgress?.({ region, scanned, discovered, absent, unscheduled, failed, cursor });
  }

  return { region, scanned, discovered, absent, unscheduled, failed, cursor };
}
