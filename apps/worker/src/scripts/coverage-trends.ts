// Recompute the /coverage snapshot-trend rows by hand, outside the cron.
//
//   pnpm --filter @unicum.gg/worker coverage-trends
//
// Reach for it to fill the tables the first time (before the next :15 tick) or
// to force a refresh while debugging. Runs the same per-region recompute the
// cron does, sequentially, against the real DB.
import { refreshCoverageTrends } from "@unicum.gg/core/coverage/trends-aggregate";

async function main(): Promise<void> {
  const start = Date.now();
  const n = await refreshCoverageTrends();
  console.log(
    `coverage-trends: refreshed ${n} region(s) in ${Date.now() - start}ms`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[coverage-trends] failed:", err);
  process.exit(1);
});
