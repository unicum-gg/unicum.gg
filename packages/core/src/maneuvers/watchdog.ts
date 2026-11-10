import { desc, eq, sql } from "drizzle-orm";
import {
  maneuversEditionsByRegion,
  maneuversSnapshotsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { createStallAlert } from "@unicum.gg/core/cron/stall-alert";
import { REGIONS, type Region } from "@unicum.gg/wargaming";

/**
 * Watches that the Maneuvers capture is still capturing, the Onslaught
 * watchdog's twin.
 *
 * The feeder can be perfectly alive while recording nothing, and that is its
 * usual way of failing: the session token it spends comes from a game client,
 * lives about an hour, and once it is rejected the feeder goes on running,
 * logging every five minutes, writing the edition row and none of the boards.
 * That is exactly how the first day of the autumn 2026 edition was lost on EU:
 * the last capture landed at 19:35 UTC on 9 November and nothing said so until
 * somebody read the page the next morning.
 *
 * So what is measured is whether snapshot rows are still landing, read off the
 * same table the page draws its figures from. It matters because the data is
 * unrecoverable: the source publishes the current instant and forgets an
 * edition the moment it ends.
 */

// Every 20 minutes, on the fives: the Onslaught watchdog holds the twenties and
// the server one the tens, so no two of them land in the channel on the same
// minute.
const SCHEDULE = "5,25,45 * * * *";

/**
 * How far behind the newest capture may fall before it counts as stalled: an
 * hour, twelve capture intervals, for the reasons the Onslaught watchdog gives
 * (a slow pass, a redeploy, a source briefly failing must not page anybody).
 */
const STALL_AFTER_MS = 60 * 60 * 1000;

const alert = createStallAlert({
  name: "maneuvers-watchdog",
  keyPrefix: "maneuvers:watchdog",
});

export type ManeuversFreshness = {
  region: Region;
  eventName: string | null;
  /** Whether the edition is being played right now. Outside its window there
   * is nothing to record, so silence is the correct state. */
  live: boolean;
  /** Age of the newest capture, null when the edition has none yet. */
  ageMs: number | null;
  /** How long nothing has landed, counted from the edition's start when
   * nothing ever has: an edition that opened ten minutes ago is new, not late. */
  behindMs: number | null;
};

/** How long ago the newest capture of the newest edition landed. */
export async function readManeuversFreshness(
  region: Region,
): Promise<ManeuversFreshness> {
  const editions = maneuversEditionsByRegion[region];
  const snapshots = maneuversSnapshotsByRegion[region];

  const [edition] = await db
    .select({
      eventName: editions.eventName,
      startDate: editions.startDate,
      endDate: editions.endDate,
    })
    .from(editions)
    // NULLS LAST, or a dateless row would win and report its empty series.
    .orderBy(sql`${editions.startDate} DESC NULLS LAST`)
    .limit(1);
  if (!edition) {
    return { region, eventName: null, live: false, ageMs: null, behindMs: null };
  }

  const [newest] = await db
    .select({ capturedAt: snapshots.capturedAt })
    .from(snapshots)
    .where(eq(snapshots.eventName, edition.eventName))
    .orderBy(desc(snapshots.capturedAt))
    .limit(1);

  const now = Date.now();
  const started = edition.startDate == null || edition.startDate.getTime() <= now;
  const ended = edition.endDate != null && edition.endDate.getTime() <= now;
  const since = newest?.capturedAt ?? edition.startDate;

  return {
    region,
    eventName: edition.eventName,
    live: started && !ended,
    ageMs: newest ? now - newest.capturedAt.getTime() : null,
    behindMs: since ? now - since.getTime() : null,
  };
}

function minutes(ms: number): number {
  return Math.round(ms / 60000);
}

/**
 * Check every region and report the ones that changed state, on the edges
 * only: one message when a capture stalls, one when it recovers. An alert
 * still open when the edition ends is dropped silently, since nothing
 * recovered.
 *
 * A region whose edition has never been captured at all is judged like any
 * other, deliberately: on a server nobody deposited a token for, the boards
 * are being lost from the first minute, which is the one thing worth hearing.
 */
export async function checkManeuversFreshness(): Promise<ManeuversFreshness[]> {
  const readings = await Promise.all(REGIONS.map(readManeuversFreshness));

  for (const r of readings) {
    if (r.eventName == null) continue;
    if (!r.live) {
      await alert.forget(r.region);
      continue;
    }

    const late = r.behindMs == null || r.behindMs > STALL_AFTER_MS;
    if (late) {
      const age = r.ageMs == null ? "never" : `${minutes(r.ageMs)} minutes ago`;
      await alert.announce(
        r.region,
        `⚠️ Maneuvers capture stalled on ${r.region.toUpperCase()}: last capture ${age} (${r.eventName}). The session token is the usual suspect, a fresh one has to be deposited. The source keeps no history, so anything missed now is lost.`,
      );
    } else {
      await alert.recover(
        r.region,
        `✅ Maneuvers capture recovered on ${r.region.toUpperCase()}: capturing again (${r.eventName}).`,
      );
    }
  }
  return readings;
}

/** One region's state, for the tick's own log line. */
export function describeManeuversFreshness(r: ManeuversFreshness): string {
  if (r.eventName == null) return `${r.region}=unseeded`;
  const age = r.ageMs == null ? "none" : `${minutes(r.ageMs)}m`;
  return r.live ? `${r.region}=${age}` : `${r.region}=${age} (off-edition)`;
}

/** Schedule the watchdog. One global job: it reads a few small rows. */
export function startManeuversWatchdogCron(): void {
  const armed = scheduleCron("maneuvers-watchdog", SCHEDULE, async () => {
    const readings = await checkManeuversFreshness();
    console.log(
      `[maneuvers-watchdog] ${readings.map(describeManeuversFreshness).join(" ")}`,
    );
  });
  if (armed) console.log(`[maneuvers-watchdog] scheduled (${SCHEDULE})`);
}
