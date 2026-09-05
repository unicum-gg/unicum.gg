import { and, asc, count, eq, lte, sql } from "drizzle-orm";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { db } from "@unicum.gg/core/db";
import {
  type ClansTable,
  clansByRegion,
  StrongholdActivityBucket,
  strongholdBucketFor,
} from "@unicum.gg/shared";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { recordClanSnapshot } from "./snapshots";
import { fetchClanStronghold } from "@unicum.gg/core/wargaming/wot/clans/stronghold";

// Ticks back to back (node-cron's 6-field form is seconds), each one guarded
// against overlap by the scheduler. A tick that finds nothing due returns in
// milliseconds, so the idle cost is a single indexed range scan per second.
const SCHEDULE = "* * * * * *";

// Clans per tick. The Stronghold host answers in ~150ms and this pool has its
// own rate limit (DEFAULT_STRONGHOLD_RPS), so the batch is sized to give the
// limiter something to pace rather than to ration requests.
const BATCH_SIZE = 50;

// Concurrent fetches inside a batch. The token bucket is what actually sets the
// rate; this only decides how many calls queue against it at once, so it stays
// modest, enough to keep the bucket drained, not enough to hold a large fan of
// in-flight sockets per region.
const CONCURRENCY = 5;

// The per-tick numbers are aggregated and logged on this interval instead of
// once per tick. At one tick a second a per-tick line is unreadable, and the
// backlog count it carried is an index-only scan over every due row: measured at
// 63ms and ~10k buffers against EU, versus 0.26ms for the claim it accompanied.
// Paying that every second, in three regions, on a database that has been taken
// down by burst load before, to print a number nobody reads that often.
const HEARTBEAT_MS = 60_000;

/**
 * Samples clan Stronghold records on an activity-driven cadence, as its own
 * per-region cron.
 *
 * It used to ride inside the clan backfill's per-clan loop, which also refreshes
 * members and events through the clan portal, a 1 rps/region budget. Measured,
 * that loop spent ~30s on 20 clans, essentially all of it waiting on the portal,
 * and dragged the Stronghold fetch along at the same pace: a full EU sweep took
 * days, so the per-period columns on the clan page diffed against baselines a
 * median of nine days old.
 *
 * Nothing about the Stronghold fetch needed that. It is a different host, off
 * the portal budget and off the public API budget (which the player snapshot
 * pipeline keeps pinned at its ceiling), and it carries its own activity signal.
 * Split out and paced by `clans.stronghold_due_at`, it samples the clans that
 * actually play every 6h and lets the idle 98% wait.
 */
export function startClanStrongholdCron(): void {
  for (const region of REGIONS) {
    const name = `clan-stronghold-cron-${region}`;
    if (
      scheduleCron(name, SCHEDULE, async () => {
        await sampleDueStrongholdsForRegion(region);
      })
    ) {
      console.log(`[${name}] stronghold sampling scheduled (${SCHEDULE})`);
    }
  }
}

export type StrongholdSampleResult = {
  processed: number;
  /** Sampled clans that hold a Stronghold record. */
  stored: number;
  /** Sampled clans the host reports no Stronghold for (its 404). */
  absent: number;
  failed: number;
};

function dueWhere(clans: ClansTable) {
  return and(
    eq(clans.isDisbanded, false),
    lte(clans.strongholdDueAt, sql`NOW()`),
  );
}

/**
 * Claim the clans whose Stronghold sample is due. Ordered by how overdue they
 * are, so a backlog drains oldest-first and the 6h clans keep their slot once it
 * has drained. An indexed range scan over the partial
 * `<region>_clans_stronghold_due_idx`, so an idle tick is a fraction of a
 * millisecond.
 */
async function pickDueForRegion(
  region: Region,
  limit: number,
): Promise<number[]> {
  const clans = clansByRegion[region];
  const rows = await db
    .select({ id: clans.id })
    .from(clans)
    .where(dueWhere(clans))
    .orderBy(asc(clans.strongholdDueAt))
    .limit(limit);
  return rows.map((r) => Number(r.id));
}

/** How many clans are waiting. Only read on the heartbeat: it scans every due
 * row, so it costs orders of magnitude more than the claim it reports on. */
async function countDueForRegion(region: Region): Promise<number> {
  const clans = clansByRegion[region];
  const [row] = await db
    .select({ due: count() })
    .from(clans)
    .where(dueWhere(clans));
  return Number(row?.due ?? 0);
}

/** Rolling per-region tally, flushed by {@link heartbeat}. */
type Tally = {
  stored: number;
  absent: number;
  failed: number;
  buckets: Map<StrongholdActivityBucket, number>;
  since: number;
};

const tallies = new Map<Region, Tally>();

function tallyFor(region: Region): Tally {
  let tally = tallies.get(region);
  if (!tally) {
    tally = { stored: 0, absent: 0, failed: 0, buckets: new Map(), since: Date.now() };
    tallies.set(region, tally);
  }
  return tally;
}

async function heartbeat(region: Region): Promise<void> {
  const tally = tallyFor(region);
  const elapsed = Date.now() - tally.since;
  if (elapsed < HEARTBEAT_MS) return;
  const sampled = tally.stored + tally.absent;
  if (sampled > 0 || tally.failed > 0) {
    const spread = [...tally.buckets.entries()]
      .map(([bucket, n]) => `${bucket}=${n}`)
      .join(" ");
    const due = await countDueForRegion(region).catch(() => -1);
    console.log(
      `[clan-stronghold-cron-${region}] last ${Math.round(elapsed / 1000)}s: ` +
        `${tally.stored} stored, ${tally.absent} absent, ${tally.failed} failed, ` +
        `${due < 0 ? "?" : due} due, ${spread}`,
    );
  }
  tallies.set(region, {
    stored: 0,
    absent: 0,
    failed: 0,
    buckets: new Map(),
    since: Date.now(),
  });
}

/**
 * Push a clan we could not reach out to a short retry rather than leaving it at
 * the head of the queue. Without this a clan that fails every time (a WG-side
 * quirk on one id) would be re-claimed on every single tick and starve the rest
 * of the region behind it.
 */
async function deferAfterFailure(
  region: Region,
  clanId: number,
): Promise<void> {
  const clans = clansByRegion[region];
  await db
    .update(clans)
    .set({ strongholdDueAt: sql`NOW() + INTERVAL '1 hour'` })
    .where(eq(clans.id, clanId));
}

export async function sampleDueStrongholdsForRegion(
  region: Region,
): Promise<StrongholdSampleResult> {
  const clanIds = await pickDueForRegion(region, BATCH_SIZE);
  if (clanIds.length === 0) {
    await heartbeat(region);
    return { processed: 0, stored: 0, absent: 0, failed: 0 };
  }

  const result: StrongholdSampleResult = {
    processed: clanIds.length,
    stored: 0,
    absent: 0,
    failed: 0,
  };
  // Counted per bucket so the log says what the cadence is actually deciding,
  // which is the only way to see the sampling policy working (or not) from the
  // outside.
  const tally = tallyFor(region);

  const queue = [...clanIds];
  const worker = async (): Promise<void> => {
    for (let clanId = queue.pop(); clanId !== undefined; clanId = queue.pop()) {
      try {
        const data = await fetchClanStronghold(region, clanId);
        const bucket = strongholdBucketFor(data);
        tally.buckets.set(bucket, (tally.buckets.get(bucket) ?? 0) + 1);
        await recordClanSnapshot(region, clanId, data);
        if (data) result.stored += 1;
        else result.absent += 1;
      } catch (err) {
        // Loud on purpose. The old code caught every Stronghold error inside the
        // SDK and returned null, so the caller's `sh && record(...)` skipped the
        // write with no trace: when the sampling rate collapsed 13x on
        // 2026-08-20 nothing in the logs said so, and it stayed unnoticed for a
        // week. A failure here has to be visible.
        result.failed += 1;
        console.error(
          `[clan-stronghold-cron-${region}] ${clanId} failed:`,
          err,
        );
        await deferAfterFailure(region, clanId).catch(() => {});
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, clanIds.length) }, worker),
  );

  tally.stored += result.stored;
  tally.absent += result.absent;
  tally.failed += result.failed;
  await heartbeat(region);
  return result;
}
