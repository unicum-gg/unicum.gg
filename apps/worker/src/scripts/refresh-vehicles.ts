// Re-read the vehicle catalogue from the wot-src mirror into `<region>_vehicles`,
// outside the cron.
//
//   pnpm --filter @unicum.gg/worker refresh-vehicles [eu|na|asia]
//
// The counterpart of `refresh-map-history` for the other half of what the
// catalogue cron does. Reach for it on an update day: Wargaming ships the client
// definitions with the preload and the localization only when the update goes
// live, so a vehicle can sit in the catalogue unnamed (and therefore hidden, see
// `catalogueNaming`) until the tick that follows the strings being published.
//
// Idempotent: every row is upserted from the mirror, so a run that finds nothing
// new rewrites the same values.
import { REGIONS, isRegion } from "@unicum.gg/wargaming";
import { refreshVehicles } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";

async function main(): Promise<void> {
  const arg = process.argv[2]?.toLowerCase();
  if (arg !== undefined && !isRegion(arg)) {
    console.error(`refresh-vehicles: unknown region "${arg}"`);
    process.exit(1);
  }
  const regions = arg ? [arg] : [...REGIONS];
  for (const region of regions) {
    const start = Date.now();
    const rows = await refreshVehicles(region);
    console.log(
      `refresh-vehicles: ${region} ${rows} row(s) in ${Date.now() - start}ms`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[refresh-vehicles] failed:", err);
  process.exit(1);
});
