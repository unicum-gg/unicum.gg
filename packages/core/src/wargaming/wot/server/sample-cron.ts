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

/**
 * How many ticks in a row may come back empty before the cron starts skipping.
 *
 * Three, because a single empty tick is ordinary (one slow answer, one blip)
 * and the series is worth one wasted attempt. Three in a row is not a blip.
 */
const EMPTY_TICKS_BEFORE_BACKOFF = 3;

/**
 * The widest the backoff goes, counted in sampling periods.
 *
 * Six periods is half an hour, and it is the cost of RECOVERY rather than of
 * the outage: when Wargaming comes back we notice up to half an hour late and
 * lose at most six samples of a curve that was already flat. Against that, a
 * sustained outage costs 756 wasted calls a day out of the SHARED Wargaming
 * budget, which is the same budget the player pipeline draws on, so an endpoint
 * nobody can reach was quietly slowing down the collection that still worked.
 */
const MAX_SKIP_PERIODS = 6;

let consecutiveEmptyTicks = 0;
let periodsToSkip = 0;
let backoffAnnounced = false;

/**
 * Whether this tick should call Wargaming at all.
 *
 * The schedule stays on the sampling interval rather than being rescheduled,
 * because the instants have to keep landing on the wall clock for the series to
 * line up. So the backoff is a skip counter here rather than a new cron
 * expression: the tick still fires every period and simply declines to spend
 * anything on a source that has not answered in a quarter of an hour.
 */
function shouldAttemptTick(): boolean {
  if (periodsToSkip > 0) {
    periodsToSkip -= 1;
    return false;
  }
  return true;
}

function noteTickOutcome(recorded: number): void {
  if (recorded > 0) {
    if (backoffAnnounced) {
      console.log("[server-online-cron] source answering again, back to every tick");
    }
    consecutiveEmptyTicks = 0;
    periodsToSkip = 0;
    backoffAnnounced = false;
    return;
  }

  consecutiveEmptyTicks += 1;
  if (consecutiveEmptyTicks < EMPTY_TICKS_BEFORE_BACKOFF) {
    console.warn("[server-online-cron] no cluster recorded this tick");
    return;
  }

  // Double the wait each time, capped. The first backoff waits one period, so
  // a short outage barely changes the cadence and a long one settles at the cap.
  const steps = consecutiveEmptyTicks - EMPTY_TICKS_BEFORE_BACKOFF;
  periodsToSkip = Math.min(2 ** steps, MAX_SKIP_PERIODS);

  // Announced once per outage rather than per tick: five days of this filled the
  // log with one identical warning every five minutes, which is how the waste
  // stayed invisible for five days.
  if (!backoffAnnounced) {
    console.warn(
      `[server-online-cron] source down for ${consecutiveEmptyTicks} ticks, backing off (up to ${MAX_SKIP_PERIODS} periods between attempts)`,
    );
    backoffAnnounced = true;
  }
}

export function startServerOnlineCron(): void {
  if (
    scheduleCron("server-online-cron", SCHEDULE, async () => {
      if (!shouldAttemptTick()) return;
      const counts = await sampleAllServersOnline();
      noteTickOutcome(Object.values(counts).reduce((a, b) => a + b, 0));
    })
  ) {
    console.log(`[server-online-cron] scheduled (${SCHEDULE})`);
  }
}
