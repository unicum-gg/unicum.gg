// One-shot: how far behind the Onslaught capture is, per region. The same read
// the watchdog cron makes, runnable by hand when someone wants to know now.
//   pnpm --filter @unicum.gg/web exec tsx --env-file=.env.local scripts/check-onslaught-capture.ts
//
// Reads only. It used to call the cron's own `checkCaptureFreshness`, which
// decides and announces: run from a laptop, it posted to the real alerts
// channel and, now that an open alert is remembered in Redis, it would have
// marked the incident as already told and silenced the worker.
import { readCaptureFreshness } from "@unicum.gg/core/wargaming/wot/players/onslaught-watchdog";
import { REGIONS } from "@unicum.gg/wargaming";

async function main() {
  for (const region of REGIONS) {
    const r = await readCaptureFreshness(region);
    const age =
      r.ageMs == null ? "no sample" : `${Math.round(r.ageMs / 60000)} min ago`;
    const season = r.eventId == null ? "-" : r.live ? r.eventId : `${r.eventId} (ended)`;
    console.log(`${r.region.padEnd(5)} ${season.padEnd(26)} ${age}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
