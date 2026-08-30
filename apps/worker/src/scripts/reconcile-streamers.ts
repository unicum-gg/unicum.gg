// Realign every tracked Twitch channel on its immutable numeric id, outside the
// cron.
//
//   pnpm --filter @unicum.gg/worker reconcile-streamers
//
// Reach for it to backfill the ids the first time (before the next 05:20 tick)
// or right after seeding a batch of curated streamers, so a typo in a channel
// name surfaces immediately instead of as a card that never shows up.
import { reconcileStreamerChannels } from "@unicum.gg/core/twitch/reconcile-cron";

async function main(): Promise<void> {
  const start = Date.now();
  const { backfilled, renamed, unresolved, vanished } =
    await reconcileStreamerChannels();
  console.log(
    `reconcile-streamers: ${backfilled} id(s) backfilled, ${renamed} login(s) realigned in ${Date.now() - start}ms`,
  );
  if (unresolved.length > 0) {
    console.warn(`  unknown to Twitch: ${unresolved.join(", ")}`);
  }
  if (vanished.length > 0) {
    console.warn(`  channel gone: ${vanished.join(", ")}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[reconcile-streamers] failed:", err);
  process.exit(1);
});
