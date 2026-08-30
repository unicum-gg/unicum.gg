// Record what the current client build changed about the game's maps, outside
// the cron.
//
//   pnpm --filter @unicum.gg/worker refresh-map-history
//
// The daily vehicles cron does this, so reach for it when the mirror has been
// rebuilt on a new client and the history should not wait for the next 07:00
// tick, or to see what a run would write right after the pipeline changed. It is
// idempotent: a build whose maps are already recorded produces no rows.
import { refreshMapHistory } from "@unicum.gg/core/wargaming/wot/maps/refresh";

async function main(): Promise<void> {
  const start = Date.now();
  const { version, changes, testVersion, testChanges } =
    await refreshMapHistory();
  console.log(
    `refresh-map-history: ${version ?? "no build"} recorded ${changes} change(s) in ${Date.now() - start}ms`,
  );
  if (testVersion) {
    console.log(`  common test ${testVersion}: ${testChanges} pending change(s)`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[refresh-map-history] failed:", err);
  process.exit(1);
});
