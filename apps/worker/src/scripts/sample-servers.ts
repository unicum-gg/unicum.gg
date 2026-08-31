// Record the clusters' population by hand, outside the cron.
//
//   pnpm --filter @unicum.gg/worker sample-servers
//   pnpm --filter @unicum.gg/worker sample-servers --watch
//
// One pass by default. `--watch` keeps sampling on the interval, which is what
// to reach for when the worker carrying the cron is not deployed yet: the
// series cannot be backfilled, so an hour nobody sampled is an hour the page
// will never be able to show.
import { SERVER_SAMPLE_INTERVAL_MINUTES } from "@unicum.gg/shared";
import { sampleAllServersOnline } from "@unicum.gg/core/wargaming/wot/server/sample-cron";

const INTERVAL_MS = SERVER_SAMPLE_INTERVAL_MINUTES * 60 * 1000;

/** Milliseconds until the next wall-clock sampling boundary. */
function untilNextPeriod(): number {
  const now = Date.now();
  return INTERVAL_MS - (now % INTERVAL_MS);
}

async function pass(): Promise<void> {
  const counts = await sampleAllServersOnline();
  const parts = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, n]) => `${region}=${n}`);
  console.log(`[sample-servers] ${new Date().toISOString()} ${parts.join(" ")}`);
}

async function main(): Promise<void> {
  const watch = process.argv.includes("--watch");
  await pass();
  if (!watch) process.exit(0);
  console.log(
    `[sample-servers] watching, every ${SERVER_SAMPLE_INTERVAL_MINUTES}min`,
  );

  // Re-armed against the wall clock after every pass rather than run on a fixed
  // interval. `setInterval` drifts by each tick's event-loop lag, and the pass
  // itself floors whenever its fetch returns; once the accumulated drift pushes
  // two passes into the same period, the second writes nothing (the primary key
  // absorbs it) and the period in between is never sampled at all. In a series
  // this script's own header calls impossible to backfill, that is a hole for
  // good, so the schedule follows the clock the periods are defined by.
  const arm = () =>
    setTimeout(() => {
      void pass()
        .catch((err) => console.error("[sample-servers] failed:", err))
        .finally(arm);
    }, untilNextPeriod());
  arm();
}

main().catch((err) => {
  console.error("[sample-servers] failed:", err);
  process.exit(1);
});
