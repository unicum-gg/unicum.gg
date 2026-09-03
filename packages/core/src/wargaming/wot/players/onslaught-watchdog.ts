import { desc, eq, sql } from "drizzle-orm";
import {
  env,
  onslaughtSeasonSnapshotsByRegion,
  onslaughtSeasonsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { postChannelMessage } from "@unicum.gg/core/discord";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
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

// Every 20 minutes. The capture writes every 15, so a single missed pass is
// invisible here and a real stall is caught within the hour.
const SCHEDULE = "*/20 * * * *";

/**
 * How far behind the newest sample may fall before it counts as stalled.
 *
 * Four capture intervals, which is generous on purpose: the pass itself can be
 * slow, a redeploy costs one, and a region the source is briefly failing writes
 * nothing rather than a zero (by design). The alert has to mean something is
 * actually wrong, or it stops being read.
 */
const STALL_AFTER_MS = 60 * 60 * 1000;

/** Regions currently known to be stalled, so a single incident alerts once. */
const stalled = new Set<Region>();

export type CaptureFreshness = {
  region: Region;
  eventId: string | null;
  lastCapture: Date | null;
  ageMs: number | null;
};

/** How long ago the newest sample of the newest season landed, per region. */
export async function readCaptureFreshness(
  region: Region,
): Promise<CaptureFreshness> {
  const seasons = onslaughtSeasonsByRegion[region];
  const snapshots = onslaughtSeasonSnapshotsByRegion[region];

  const [season] = await db
    .select({ eventId: seasons.eventId })
    .from(seasons)
    // NULLS LAST, like every other newest-season read: Postgres sorts DESC with
    // nulls first, so a dateless row would win and report its empty series.
    .orderBy(sql`${seasons.startDate} DESC NULLS LAST`)
    .limit(1);
  if (!season) {
    return { region, eventId: null, lastCapture: null, ageMs: null };
  }

  const [newest] = await db
    .select({ capturedAt: snapshots.capturedAt })
    .from(snapshots)
    .where(eq(snapshots.eventId, season.eventId))
    .orderBy(desc(snapshots.capturedAt))
    .limit(1);

  return {
    region,
    eventId: season.eventId,
    lastCapture: newest?.capturedAt ?? null,
    ageMs: newest ? Date.now() - newest.capturedAt.getTime() : null,
  };
}

function minutes(ms: number): number {
  return Math.round(ms / 60000);
}

/**
 * Check every region and report the ones that changed state.
 *
 * Reports on the EDGES only, so an incident is one message and its recovery is
 * another, rather than a line every twenty minutes for as long as it lasts. The
 * memory is per process, so a worker restart can repeat one alert, which is the
 * right way round: a repeated warning is noise, a silent one is a missed
 * outage.
 */
export async function checkCaptureFreshness(): Promise<CaptureFreshness[]> {
  const readings = await Promise.all(REGIONS.map(readCaptureFreshness));

  for (const r of readings) {
    // A region with no season at all is not stalled, it is unseeded: the very
    // first capture has not run yet, and there is nothing to be late for.
    if (r.eventId == null) continue;
    const late = r.ageMs == null || r.ageMs > STALL_AFTER_MS;

    if (late && !stalled.has(r.region)) {
      stalled.add(r.region);
      const age =
        r.ageMs == null ? "never" : `${minutes(r.ageMs)} minutes ago`;
      await report(
        `⚠️ Onslaught capture stalled on ${r.region.toUpperCase()}: last sample ${age} (${r.eventId}). The source keeps no history, so anything missed now is lost.`,
      );
    } else if (!late && stalled.has(r.region)) {
      stalled.delete(r.region);
      await report(
        `✅ Onslaught capture recovered on ${r.region.toUpperCase()}: sampling again (${r.eventId}).`,
      );
    }
  }
  return readings;
}

/** Say it in the channel when there is one, and in the logs either way. */
async function report(message: string): Promise<void> {
  console.warn(`[onslaught-watchdog] ${message}`);
  const channel = env.DISCORD_ALERTS_CHANNEL_ID;
  if (!channel) return;
  try {
    await postChannelMessage(channel, message);
  } catch (err) {
    console.error("[onslaught-watchdog] could not reach Discord:", err);
  }
}

/** Schedule the watchdog. One global job: it reads three small rows. */
export function startOnslaughtWatchdogCron(): void {
  scheduleCron("onslaught-watchdog", SCHEDULE, async () => {
    const readings = await checkCaptureFreshness();
    const summary = readings
      .map(
        (r) =>
          `${r.region}=${r.ageMs == null ? "none" : `${minutes(r.ageMs)}m`}`,
      )
      .join(" ");
    console.log(`[onslaught-watchdog] ${summary}`);
  });
}
