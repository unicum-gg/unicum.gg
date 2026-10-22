import { SERVER_SAMPLE_INTERVAL_MINUTES } from "@unicum.gg/shared";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { createStallAlert } from "@unicum.gg/core/cron/stall-alert";
import { readLastSampleAt } from "./history";

/**
 * Watches that the population sampler is still sampling.
 *
 * `server-online-cron` is the entire archive. Wargaming answers how many people
 * are playing right now and keeps nothing, and nobody else archives the series,
 * so an hour nobody recorded is an hour no later run can go back for. There is
 * nothing to probe either: the cron runs in a service that serves no HTTP, and
 * a probe would answer the wrong question anyway, since the process can be
 * perfectly alive while writing nothing. What matters is whether rows are
 * landing, so that is what this measures.
 *
 * It is written because the absence of it cost fourteen days.
 * `wgn/servers/info` has answered `504 SOURCE_NOT_AVAILABLE` on all three
 * regions since 2026-10-08. The cron kept ticking every five minutes and
 * correctly wrote nothing (a failed fetch must not be stored as a zero, which
 * is indistinguishable from a dead cluster), the log said `tick completed in
 * 28ms` throughout, and the first anyone knew of it was a reader finding an
 * empty page. The only observable difference between that and a healthy day was
 * rows not landing.
 */

/**
 * Every twenty minutes, which is far slower than the sampler writes: this
 * watches for a stall rather than for a pass, and a real one is caught inside
 * the hour either way. Offset from the sampler's own wall-clock instants, and
 * from `onslaught-watchdog`, which runs on the twenties.
 */
const SCHEDULE = "10,30,50 * * * *";

/**
 * How far behind the newest sample may fall before it counts as stalled.
 *
 * An hour, which is twelve sampling intervals and generous on purpose. The
 * floor under it is the sampler's own backoff: after three empty ticks it
 * starts skipping, up to six periods (half an hour) between attempts, so a
 * source that recovers can take that long to write its first row again. Half of
 * this threshold, which leaves the whole of the other half as margin before a
 * person is told something is wrong.
 */
const STALL_AFTER_MS = 60 * 60 * 1000;

const alert = createStallAlert({
  name: "server-online-watchdog",
  keyPrefix: "server-online:watchdog",
});

export type SamplingFreshness = {
  region: Region;
  /** The newest sample on record, null when this region has never been sampled. */
  lastSample: Date | null;
  /** Its age, null when there is none. */
  ageMs: number | null;
};

/** How long ago this region's newest sample landed. */
export async function readSamplingFreshness(
  region: Region,
): Promise<SamplingFreshness> {
  const lastSample = await readLastSampleAt(region);
  return {
    region,
    lastSample,
    ageMs: lastSample ? Date.now() - lastSample.getTime() : null,
  };
}

/**
 * An age a person can read at a glance, at whatever scale the outage has
 * reached. The unit has to move, because this is the one watchdog whose live
 * state when it was written was a fortnight old, and "20160 minutes ago" is a
 * number nobody converts.
 */
function describeAge(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 120) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** The instant itself, UTC, since a long gap is read by its date rather than
 * by its length. */
function describeInstant(at: Date): string {
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * Check every region and report the ones that changed state.
 *
 * Reports on the EDGES only, so an incident is one message and its recovery is
 * another, rather than a line every twenty minutes for as long as it lasts.
 *
 * Judged per region rather than over the three together, because a region can
 * go dark on its own: this same endpoint answered 504 on Asia alone while EU
 * and NA were serving normally. A total outage therefore costs three messages,
 * which is the honest reading of three regions losing their history.
 */
export async function checkSamplingFreshness(): Promise<SamplingFreshness[]> {
  const readings = await Promise.all(REGIONS.map(readSamplingFreshness));

  for (const r of readings) {
    // A region that has never been sampled is not stalled, it is new: there is
    // no instant to be late for, and the very first tick has yet to land.
    if (!r.lastSample || r.ageMs == null) continue;

    if (r.ageMs > STALL_AFTER_MS) {
      await alert.announce(
        r.region,
        `⚠️ Server sampling stalled on ${r.region.toUpperCase()}: last sample ${describeAge(r.ageMs)} (${describeInstant(r.lastSample)}). Wargaming publishes the current instant and keeps no history, so every sample missed from here is a hole in the population curve that nothing can fill.`,
      );
    } else {
      await alert.recover(
        r.region,
        `✅ Server sampling recovered on ${r.region.toUpperCase()}: rows landing again, newest ${describeAge(r.ageMs)}.`,
      );
    }
  }
  return readings;
}

/** One region's state, for the tick's own log line. */
export function describeSamplingFreshness(r: SamplingFreshness): string {
  if (r.ageMs == null) return `${r.region}=never`;
  return `${r.region}=${Math.round(r.ageMs / 60_000)}m`;
}

/** Schedule the watchdog. One global job: it reads three single-row queries. */
export function startServerOnlineWatchdogCron(): void {
  const armed = scheduleCron("server-online-watchdog", SCHEDULE, async () => {
    const readings = await checkSamplingFreshness();
    console.log(
      `[server-online-watchdog] ${readings.map(describeSamplingFreshness).join(" ")} (stall after ${STALL_AFTER_MS / 60_000}m, sampling every ${SERVER_SAMPLE_INTERVAL_MINUTES}m)`,
    );
  });
  if (armed) console.log(`[server-online-watchdog] scheduled (${SCHEDULE})`);
}
