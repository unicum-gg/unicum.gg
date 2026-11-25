// Announce game changes by hand, outside the poll.
//
//   pnpm --filter @unicum.gg/worker game-changes:dry   → render the cards, print them, post nothing
//   pnpm --filter @unicum.gg/worker game-changes       → announce what is pending now
//
// The dry run reads the real history and leaves Discord and every marker
// untouched. With no marker stored yet it previews the newest version, which
// is the one thing a scheduled run deliberately does NOT post (see the seeding
// note in `@unicum.gg/core/game-changes/versions`).
//
// Both scripts pin `NEXT_PUBLIC_APP_URL` to the live site, because every link
// on the cards comes from it: run from a dev machine it would otherwise send a
// community channel to localhost.
import { describeAnnouncement } from "@unicum.gg/core/discord/announce";
import {
  GameChangesOutcome,
  publishGameChanges,
} from "@unicum.gg/core/game-changes";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry");
  const results = await publishGameChanges({ dryRun });
  for (const result of results) {
    console.log(`\n##### ${result.product}: ${result.outcome}`);
    for (const { label, announcement } of result.announced) {
      console.log(`\n=== ${label}\n${describeAnnouncement(announcement)}`);
    }
  }
  process.exit(
    results.some((r) => r.outcome === GameChangesOutcome.Failed) ? 1 : 0,
  );
}

main().catch((err) => {
  console.error("[game-changes] failed:", err);
  process.exit(1);
});
