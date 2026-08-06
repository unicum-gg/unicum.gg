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
import { publishChangelog } from "@unicum.gg/core/changelog";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry");
  // `--model=gpt-5.6-luna` to preview what a different model would have written.
  const model = process.argv
    .find((arg) => arg.startsWith("--model="))
    ?.slice("--model=".length);
  const result = await publishChangelog({ dryRun, model });

  console.log(`\noutcome: ${result.outcome} (${result.commits} commits)\n`);
  if (result.message) console.log(result.message);
  process.exit(0);
}

main().catch((err) => {
  console.error("[changelog] failed:", err);
  process.exit(1);
});
