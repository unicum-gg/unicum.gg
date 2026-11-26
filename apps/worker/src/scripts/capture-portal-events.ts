// Record the portals' events widgets by hand, outside the cron.
//
//   pnpm --filter @unicum.gg/worker capture-portal-events
//   pnpm --filter @unicum.gg/worker capture-portal-events --dry
//
// One pass over the three regions. `--dry` prints what each widget holds in
// English and writes nothing. The widget keeps the current week only, so this
// is what to run when the worker carrying the cron is not deployed yet.
import { REGIONS } from "@unicum.gg/wargaming";
import { wg } from "@unicum.gg/core/wargaming/client";
import { captureAllPortalEvents } from "@unicum.gg/core/portal-events/cron";

async function dry(): Promise<void> {
  for (const region of REGIONS) {
    const entries = await wg.region(region).portal.events.calendar();
    console.log(`\n${region.toUpperCase()} (${entries.length})`);
    for (const entry of entries) {
      console.log(
        `  ${entry.start.toISOString()} → ${entry.end.toISOString()}  [${entry.category}] ${entry.title}\n    ${entry.link}`,
      );
    }
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--dry")) await dry();
  else console.log("[capture-portal-events]", await captureAllPortalEvents());
  process.exit(0);
}

main().catch((err) => {
  console.error("[capture-portal-events] failed:", err);
  process.exit(1);
});
