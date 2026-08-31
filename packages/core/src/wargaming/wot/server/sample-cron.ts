import {
  SERVER_SAMPLE_INTERVAL_MINUTES,
  serverOnlineByRegion,
} from "@unicum.gg/shared";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { fetchPlayersOnline } from "./online";

/**
 * Record every region's cluster population, on the sampling interval.
 *
 * This cron is the entire history. Wargaming answers "how many are playing right
 * now" and keeps nothing, and no third party archives the series either, so a
 * tick that does not run is an hour of the curve that no later run can recover.
 * That asymmetry sets the shape of everything below: the write is idempotent so
 * a retry is free, a failed fetch writes nothing rather than a zero, and the
 * regions are sampled independently so one region's outage costs only its own
 * row.
 */

// On the interval itself, so the samples land on the wall clock (:00, :05, ...).
// Every region of one tick shares that instant, decided before the calls go out.
const SCHEDULE = `*/${SERVER_SAMPLE_INTERVAL_MINUTES} * * * *`;

const PERIOD_MS = SERVER_SAMPLE_INTERVAL_MINUTES * 60 * 1000;

/**
 * The sampling instant a moment belongs to, floored to the interval.
 *
 * The tick fires a second or two past the minute and the three regions' calls
 * return whenever Wargaming answers, so the raw timestamps would scatter across
 * a few seconds and no two clusters would ever share one. Flooring gives every
 * cluster of a period one timestamp, which is what lets a region total be a
 * plain GROUP BY and what makes the primary key deduplicate a re-run.
 */
export function floorToSamplePeriod(at: Date): Date {
  return new Date(Math.floor(at.getTime() / PERIOD_MS) * PERIOD_MS);
}

/**
 * Sample one region. Returns how many clusters were recorded, zero when there
 * was nothing to record.
 *
 * A failed Wargaming call arrives as null and is dropped rather than written as
 * an empty region: zeros would be indistinguishable from a genuine shutdown and
 * would drag every average through them for as long as the table lives. The
 * same reasoning covers a successful call carrying no cluster at all.
 */
export async function sampleServerOnline(
  region: Region,
  /** The instant this whole tick belongs to. Passed in rather than read here,
   * because it must be decided BEFORE the Wargaming call, not after: a region
   * whose fetch is slow (the transport retries with an i*i*2 backoff behind the
   * G-Core limiter) would otherwise floor into a later period than its
   * siblings, and the three regions would stop sharing a timeline. The
   * comparison chart merges them on equal timestamps, so a drifted region draws
   * a hole rather than a line. */
  sampledAt: Date,
): Promise<number> {
  const payload = await fetchPlayersOnline(region);
  if (!payload || payload.servers.length === 0) return 0;

  await db
    .insert(serverOnlineByRegion[region])
    .values(
      payload.servers.map((s) => ({
        server: s.server,
        sampledAt,
        playersOnline: s.players_online,
      })),
    )
    // The period is already recorded (a retry, or a second executor that beat
    // the lease). Keep what is there: two calls seconds apart are the same
    // instant as far as the series is concerned.
    .onConflictDoNothing();

  return payload.servers.length;
}

/**
 * Sample every region concurrently. Their Wargaming calls are three cheap reads
 * on three separate rate-limit lanes, so nothing is gained by serializing them,
 * and a region that fails must not delay the others past the interval.
 */
export async function sampleAllServersOnline(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  // One instant for the whole tick, fixed before any call goes out.
  const sampledAt = floorToSamplePeriod(new Date());
  await Promise.all(
    REGIONS.map(async (region) => {
      try {
        counts[region] = await sampleServerOnline(region, sampledAt);
      } catch (err) {
        console.error(`[server-online-cron] ${region} failed:`, err);
        counts[region] = 0;
      }
    }),
  );
  return counts;
}

export function startServerOnlineCron(): void {
  if (
    scheduleCron("server-online-cron", SCHEDULE, async () => {
      const counts = await sampleAllServersOnline();
      const recorded = Object.values(counts).reduce((a, b) => a + b, 0);
      if (recorded === 0) {
        console.warn("[server-online-cron] no cluster recorded this tick");
      }
    })
  ) {
    console.log(`[server-online-cron] scheduled (${SCHEDULE})`);
  }
}
