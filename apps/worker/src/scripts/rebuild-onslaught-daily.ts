// Rebuild the Onslaught daily fold from the capture history, in full.
//
// The cron keeps the last few days of the current season in step, which is all
// that can still move. This rebuilds a whole season, which is what a change to
// what counts as a day's activity needs, and what a past season needs the once
// (the cron only ever looks at the current one).
//
//   pnpm --filter @unicum.gg/worker rebuild-onslaught-daily [eu|na|asia] [--season comp7:2026-09-02]
//
// With no season it does every season the region holds captures for. Idempotent:
// each season's rows are replaced, so an interrupted run is re-run, not repaired.
import {
  listOnslaughtCapturedSeasons,
  rebuildOnslaughtDaily,
} from "@unicum.gg/core/wargaming/wot/players/onslaught-daily";
import { regionArgs } from "./args";

function seasonArg(): string | undefined {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--season");
  return at < 0 ? undefined : argv[at + 1];
}

async function main() {
  const only = seasonArg();
  for (const region of regionArgs()) {
    for (const eventId of await listOnslaughtCapturedSeasons(region)) {
      if (only && eventId !== only) continue;
      const started = Date.now();
      const rows = await rebuildOnslaughtDaily(region, eventId, null);
      console.log(
        `[${region}] ${eventId}: ${rows} day(s) written in ${Date.now() - started}ms`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
