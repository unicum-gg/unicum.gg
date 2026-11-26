// Publish the recorded calendar entries to the community server by hand.
//
//   pnpm --filter @unicum.gg/worker publish-portal-events --dry
//   pnpm --filter @unicum.gg/worker publish-portal-events
//
// `--dry` prints the scheduled events and cards that would be written and
// touches neither Discord nor the database. Without it this creates the events
// and posts the cards now, ignoring the daytime window the cron keeps.
import { publishPortalEvents } from "@unicum.gg/core/portal-events";

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");
  const lines = await publishPortalEvents({ dry });
  console.log(lines.join("\n\n") || "nothing to publish");
  process.exit(0);
}

main().catch((err) => {
  console.error("[publish-portal-events] failed:", err);
  process.exit(1);
});
