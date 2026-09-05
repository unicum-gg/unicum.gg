// One-shot: how far behind the Onslaught capture is, per region. The same read
// the watchdog cron makes, runnable by hand when someone wants to know now.
//   pnpm --filter @unicum.gg/web exec tsx --env-file=.env.local scripts/check-onslaught-capture.ts
import { checkCaptureFreshness } from "@unicum.gg/core/wargaming/wot/players/onslaught-watchdog";

async function main() {
  for (const r of await checkCaptureFreshness()) {
    const age =
      r.ageMs == null ? "no sample" : `${Math.round(r.ageMs / 60000)} min ago`;
    console.log(`${r.region.padEnd(5)} ${(r.eventId ?? "-").padEnd(18)} ${age}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
