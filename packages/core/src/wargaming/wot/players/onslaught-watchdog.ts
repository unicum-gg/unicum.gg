import { desc, eq, sql } from "drizzle-orm";
import {
  onslaughtSeasonSnapshotsByRegion,
  onslaughtSeasonsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { createStallAlert } from "@unicum.gg/core/cron/stall-alert";
import { REGIONS, type Region } from "@unicum.gg/wargaming";

/**
 * Watches that the Onslaught capture is still capturing.
 *
 * The capture runs in a separate service that serves no HTTP, so there is
 * nothing to probe, and probing it would answer the wrong question anyway: a
 * process can be perfectly alive while writing nothing, because the database
 * moved, the board started erroring, or the loop wedged. What matters is
 * whether rows are still landing, so that is what this measures.
 *
 * It matters because the data is unrecoverable. The source publishes the
 * current instant and keeps no history, so an hour nobody recorded is an hour
 * that no later run can go back for. Before this, a stopped capture would have
 * been noticed by looking at the curve, days later.
 */

// Every 20 minutes, which is slower than the capture writes (five minutes) on
// purpose: this watches for a stall, not for a pass, and a real one is caught
// within the hour either way.
const SCHEDULE = "*/20 * * * *";

/**
 * How far behind the newest sample may fall before it counts as stalled.
 *
 * An hour, which is many capture intervals and generous on purpose: the pass
 * itself can be slow, a redeploy costs one, and a region the source is briefly
 * failing writes nothing rather than a zero (by design). The alert has to mean
 * something is actually wrong, or it stops being read. Deliberately expressed
 * as a duration rather than as a count of intervals, so it stays true when the
 * capture's cadence changes, as it has once already.
 */
const STALL_AFTER_MS = 60 * 60 * 1000;

const alert = createStallAlert({
  name: "onslaught-watchdog",
  // The spelling the open incidents are already keyed under in Redis. It must
  // not change: a new prefix reads as "never announced" and re-announces every
  // stall that is open at the moment of the deploy.
  keyPrefix: "onslaught:watchdog",
});

export type CaptureFreshness = {
  region: Region;
  eventId: string | null;
  /**
   * Whether a season is being played right now. Outside that window the source
   * publishes no board at all, so nothing landing is the correct state rather
   * than a stall.
   */
  live: boolean;
  lastCapture: Date | null;
  /** Age of the newest sample, null when the season has none yet. */
  ageMs: number | null;
  /**
   * How long nothing has landed, measured from the season's start when nothing
   * ever has: a season that opened ten minutes ago is not behind, it is new.
   */
  behindMs: number | null;
};

/** How long ago the newest sample of the newest season landed, per region. */
export async function readCaptureFreshness(
  region: Region,
): Promise<CaptureFreshness> {
  const seasons = onslaughtSeasonsByRegion[region];
  const snapshots = onslaughtSeasonSnapshotsByRegion[region];

  const [season] = await db
    .select({
      eventId: seasons.eventId,
      startDate: seasons.startDate,
      endDate: seasons.endDate,
    })
    .from(seasons)
    // NULLS LAST, like every other newest-season read: Postgres sorts DESC with
    // nulls first, so a dateless row would win and report its empty series.
    .orderBy(sql`${seasons.startDate} DESC NULLS LAST`)
    .limit(1);
  if (!season) {
    return {
      region,
      eventId: null,
      live: false,
      lastCapture: null,
      ageMs: null,
      behindMs: null,
    };
  }

  const [newest] = await db
    .select({ capturedAt: snapshots.capturedAt })
    .from(snapshots)
    .where(eq(snapshots.eventId, season.eventId))
    .orderBy(desc(snapshots.capturedAt))
    .limit(1);

  const now = Date.now();
  // A null bound is read as "no bound": the feeder stamps both from the event
  // definition, but a season it has only half-written must still be watched,
  // since a missed hour of it is lost either way.
  const started = season.startDate == null || season.startDate.getTime() <= now;
  const ended = season.endDate != null && season.endDate.getTime() <= now;
  const since = newest?.capturedAt ?? season.startDate;

  return {
    region,
    eventId: season.eventId,
    live: started && !ended,
    lastCapture: newest?.capturedAt ?? null,
    ageMs: newest ? now - newest.capturedAt.getTime() : null,
    behindMs: since ? now - since.getTime() : null,
  };
}

function minutes(ms: number): number {
  return Math.round(ms / 60000);
}

/**
 * Check every region and report the ones that changed state.
 *
 * Reports on the EDGES only, so an incident is one message and its recovery is
 * another, rather than a line every twenty minutes for as long as it lasts.
 *
 * A region is only judged while its season is being played. Outside that
 * window the source serves no board, so the capture correctly writes nothing,
 * and reading that as a stall is a false alarm that cannot clear itself: a
 * finished season stays finished for weeks, so every redeploy replayed the
 * same three warnings (observed over 2026-10-11/12, with the season having
 * ended on the 10th and 11th). An open alert is dropped silently when the
 * season ends rather than announced as a recovery, since nothing recovered.
 */
export async function checkCaptureFreshness(): Promise<CaptureFreshness[]> {
  const readings = await Promise.all(REGIONS.map(readCaptureFreshness));

  for (const r of readings) {
    // A region with no season at all is not stalled, it is unseeded: the very
    // first capture has not run yet, and there is nothing to be late for.
    if (r.eventId == null) continue;
    if (!r.live) {
      await alert.forget(r.region);
      continue;
    }

    const late = r.behindMs == null || r.behindMs > STALL_AFTER_MS;
    if (late) {
      const age = r.ageMs == null ? "never" : `${minutes(r.ageMs)} minutes ago`;
      await alert.announce(
        r.region,
        `⚠️ Onslaught capture stalled on ${r.region.toUpperCase()}: last sample ${age} (${r.eventId}). The source keeps no history, so anything missed now is lost.`,
      );
    } else {
      await alert.recover(
        r.region,
        `✅ Onslaught capture recovered on ${r.region.toUpperCase()}: sampling again (${r.eventId}).`,
      );
    }
  }
  return readings;
}

/** One region's state, for the tick's own log line. */
export function describeFreshness(r: CaptureFreshness): string {
  if (r.eventId == null) return `${r.region}=unseeded`;
  const age = r.ageMs == null ? "none" : `${minutes(r.ageMs)}m`;
  return r.live ? `${r.region}=${age}` : `${r.region}=${age} (off-season)`;
}

/** Schedule the watchdog. One global job: it reads three small rows. */
export function startOnslaughtWatchdogCron(): void {
  const armed = scheduleCron("onslaught-watchdog", SCHEDULE, async () => {
    const readings = await checkCaptureFreshness();
    console.log(`[onslaught-watchdog] ${readings.map(describeFreshness).join(" ")}`);
  });
  if (armed) console.log(`[onslaught-watchdog] scheduled (${SCHEDULE})`);
}
