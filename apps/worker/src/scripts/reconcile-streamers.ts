// Realign every tracked Twitch channel on its immutable numeric id, outside the
// cron.
//
//   pnpm --filter @unicum.gg/worker reconcile-streamers
//
// Reach for it to backfill the ids the first time (before the next 05:20 tick)
// or right after seeding a batch of curated streamers, so a typo in a channel
// name surfaces immediately instead of as a card that never shows up.
import { isTwitchEnabled } from "@unicum.gg/core/twitch";
import {
  reconcileStreamerChannels,
  reportProblems,
} from "@unicum.gg/core/twitch/reconcile-cron";

async function main(): Promise<void> {
  // Refuses rather than reporting an empty run: the whole point of running this
  // by hand is to trust the output, and without credentials a typo'd channel
  // would go unchecked behind a line that reads like success.
  if (!isTwitchEnabled()) {
    console.error(
      "reconcile-streamers: TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are not set, nothing was checked",
    );
    process.exit(1);
  }
  const start = Date.now();
  const r = await reconcileStreamerChannels();
  // Row counts, not channel counts: one streamer can hold several WoT accounts,
  // and each of their rows is written.
  console.log(
    `reconcile-streamers: ${r.backfilled} row(s) backfilled, ${r.renamed} renamed, ${r.normalised} normalised in ${Date.now() - start}ms`,
  );
  reportProblems(r);
  process.exit(0);
}

main().catch((err) => {
  console.error("[reconcile-streamers] failed:", err);
  process.exit(1);
});
