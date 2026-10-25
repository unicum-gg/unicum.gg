// Copy each account's latest Personal Rating and WTR onto its player row.
//
//   pnpm --filter @unicum.gg/worker backfill-account-ratings [eu|na|asia] [--from PLAYER_ID]
//
// Run once, after migration 0135. The snapshot path keeps the two columns
// current for every account that plays; this fills the ones that have not
// played since. A copy out of our own snapshots, so it costs no Wargaming
// call. Idempotent and resumable: it only writes rows still holding a null,
// and `--from` restarts at the player id the last progress line printed, for the
// one region named beside it.
import { numberArg, regionArgs } from "./args";
import { backfillAccountRatings } from "@unicum.gg/core/players/account-ratings";

async function main(): Promise<void> {
  const from = numberArg("--from");
  const regions = regionArgs();
  // A player id belongs to one region's table, so resuming from one is only
  // meaningful for that region: applied to the others it would silently skip
  // every account below it there.
  if (from !== undefined && regions.length !== 1) {
    console.error("--from resumes one region: name it (eu, na or asia).");
    process.exit(1);
  }
  for (const region of regions) {
    const started = Date.now();
    let lastLog = 0;
    const written = await backfillAccountRatings(region, {
      from,
      onProgress: (at, total) => {
        if (Date.now() - lastLog < 10_000) return;
        lastLog = Date.now();
        console.log(`[backfill-account-ratings-${region}] up to id ${at}, ${total} written`);
      },
    });
    console.log(
      `[backfill-account-ratings-${region}] done: ${written} rows in ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}

void main().then(() => process.exit(0));
