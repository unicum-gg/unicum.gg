// Announce the mod's releases by hand, outside the poll.
//
//   pnpm --filter @unicum.gg/worker mod-changelog:dry   → render it, print it, post nothing
//   pnpm --filter @unicum.gg/worker mod-changelog       → announce what is pending now
//
// The dry run is what to reach for before arming the feature: it reads the real
// releases and renders the real message, but leaves both Discord and the marker
// untouched. With no marker stored yet it previews the newest release, which is
// the one thing a scheduled run will deliberately NOT do (see the seeding note
// in `@unicum.gg/core/changelog/mod`).
//
// Both scripts pin `NEXT_PUBLIC_APP_URL` to the live site (a shell variable wins
// over `--env-file`), because the message's closing link comes from it: run from
// a dev machine it would otherwise send a community channel to localhost.
import {
  ModChangelogOutcome,
  publishModChangelog,
} from "@unicum.gg/core/changelog/mod";
import { describeAnnouncement } from "@unicum.gg/core/discord/announce";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry");
  const result = await publishModChangelog({ dryRun });

  const versions =
    result.versions.length > 0 ? ` (${result.versions.join(", ")})` : "";
  console.log(`\noutcome: ${result.outcome}${versions}\n`);
  // Each release's card and its thread as text.
  for (const announcement of result.announcements ?? []) {
    console.log(describeAnnouncement(announcement));
  }
  // A run that did not publish must not read as one that did: this is called
  // from a shell, and `&&` after it should not carry on as if the announcement
  // went out.
  process.exit(result.outcome === ModChangelogOutcome.Failed ? 1 : 0);
}

main().catch((err) => {
  console.error("[mod-changelog] failed:", err);
  process.exit(1);
});
