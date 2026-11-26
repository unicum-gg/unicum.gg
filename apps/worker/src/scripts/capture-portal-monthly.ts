// Record the "WoT Monthly" calendars by hand, outside the cron.
//
//   pnpm --filter @unicum.gg/worker capture-portal-monthly
//   pnpm --filter @unicum.gg/worker capture-portal-monthly --backfill [eu|na|asia]
//
// Without a flag, the months around today, like the cron. `--backfill` walks
// every month since the widget format began (March 2025), one region at a time,
// which is safe to re-run: every write is an upsert.
import { REGIONS, isRegion } from "@unicum.gg/wargaming";
import { captureRecentMonthlyEvents } from "@unicum.gg/core/portal-events/cron";
import { allMonthlyPeriods, captureMonthlyEvents } from "@unicum.gg/core/portal-events";

async function backfill(only: string | undefined): Promise<void> {
  const regions = only && isRegion(only) ? [only] : REGIONS;
  for (const region of regions) {
    for (const { year, month } of allMonthlyPeriods(new Date())) {
      const n = await captureMonthlyEvents(region, year, month);
      console.log(`[capture-portal-monthly] ${region} ${year}-${String(month).padStart(2, "0")}: ${n ?? "no article"}`);
    }
  }
}

async function main(): Promise<void> {
  const i = process.argv.indexOf("--backfill");
  if (i >= 0) await backfill(process.argv[i + 1]);
  else console.log("[capture-portal-monthly]", await captureRecentMonthlyEvents());
  process.exit(0);
}

main().catch((err) => {
  console.error("[capture-portal-monthly] failed:", err);
  process.exit(1);
});
