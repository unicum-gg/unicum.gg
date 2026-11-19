// Read what every archived replay says about its recorder (per-enemy
// performance, mastery badge).
//
//   pnpm --filter @unicum.gg/worker backfill-replay-by [eu|na|asia] [--limit N]
//
// Reads each stored file's own results, no Wargaming call. Safe to interrupt
// and re-run: only replays not read yet are fetched.
import { numberArg, regionArgs } from "./args";
import { backfillReplayFiles } from "@unicum.gg/core/battles/replays";

async function main(): Promise<void> {
  const limit = numberArg("--limit");
  for (const region of regionArgs()) {
    const at = Date.now();
    const result = await backfillReplayFiles(region, {
      limit,
      onProgress: (done, filled) => {
        process.stdout.write(`[replay-by-${region}] ${done} read, ${filled} read ok\n`);
      },
    });
    console.log(
      `[replay-by-${region}] done in ${Math.round((Date.now() - at) / 1000)}s: ` +
        `${result.done} read, ${result.filled} read ok`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[replay-by] failed:", err);
  process.exit(1);
});
