// Seed the tournament mirror from Wargaming's tournament system, outside the
// cron.
//
//   pnpm --filter @unicum.gg/worker seed-tournaments [eu|na|asia] [--limit N]
//
// The hourly cron only drains a bounded batch, by design, so this is what brings
// in the back catalogue: every settled tournament a region has run, back to
// 2018, with its teams, rosters and full bracket. It walks at the tournament
// pool's own pace (a few requests a second against one host), so a region takes
// hours. Safe to interrupt and re-run: it only ever claims what is still
// unmirrored, so a second run resumes rather than restarts.
import type { Region } from "@unicum.gg/wargaming";
import { numberArg, regionArgs } from "./args";
import { seedRegion } from "@unicum.gg/core/tournaments/backfill";

async function main(): Promise<void> {
  const regions = regionArgs();
  const limit = numberArg("--limit");
  const start = Date.now();
  for (const region of regions) {
    const at = Date.now();
    const result = await seedRegion(region, {
      limit,
      onProgress: ({ mirrored, failed }) => {
        // One line per 25, so a multi-hour run is followable without a line per
        // tournament.
        if ((mirrored + failed) % 25 === 0) {
          process.stdout.write(
            `[seed-tournaments-${region}] ${mirrored} mirrored, ${failed} failed\n`,
          );
        }
      },
    });
    console.log(
      `[seed-tournaments-${region}] done in ${Math.round((Date.now() - at) / 1000)}s: ` +
        `${result.mirrored} mirrored, ${result.failed} failed, ${result.remaining} left`,
    );
  }
  console.log(`seed-tournaments: finished in ${Math.round((Date.now() - start) / 1000)}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-tournaments] failed:", err);
  process.exit(1);
});
