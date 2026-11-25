// Run the changelog digest by hand, outside its schedule.
//
//   pnpm --filter @unicum.gg/worker changelog:dry   → write it, print it, post nothing
//   pnpm --filter @unicum.gg/worker changelog       → write it and post it now
//
// The dry run is the one to reach for while tuning the writer: it reads the real
// commits and calls the real model, but leaves both Discord and the published
// marker untouched, so it can be run as often as needed.
//
// Both scripts pin `NEXT_PUBLIC_APP_URL` to the live site (a shell variable wins
// over `--env-file`), because the message's closing link comes from it: run from
// a dev machine it would otherwise send a community channel to localhost.
import { ChangelogOutcome, publishChangelog } from "@unicum.gg/core/changelog";
import { describeAnnouncement } from "@unicum.gg/core/discord/announce";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry");
  // `--model=gpt-5.6-luna` to preview what a different model would have written.
  const model = process.argv
    .find((arg) => arg.startsWith("--model="))
    ?.slice("--model=".length);
  const result = await publishChangelog({ dryRun, model });

  console.log(`\noutcome: ${result.outcome} (${result.commits} commits)\n`);
  // The card and its thread as text, so the cut between the two can be read.
  if (result.announcement) {
    console.log(describeAnnouncement(result.announcement));
  }
  // A run that did not publish must not read as one that did: this is called
  // from a shell, and `&&` after it should not carry on as if the update went
  // out.
  process.exit(result.outcome === ChangelogOutcome.Failed ? 1 : 0);
}

main().catch((err) => {
  console.error("[changelog] failed:", err);
  process.exit(1);
});
