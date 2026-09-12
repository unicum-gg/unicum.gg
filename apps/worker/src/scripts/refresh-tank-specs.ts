// Rebuild the global `tank_specs` catalogue by hand.
//
//   pnpm --filter @unicum.gg/worker refresh-tank-specs
//
// The vehicles cron runs this nightly. Worth running by hand after a change to
// what it stores, since the table is what every tank page reads its
// characteristics and its historical description from.
import { refreshTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";

async function main(): Promise<void> {
  const started = Date.now();
  const rows = await refreshTankSpecs();
  console.log(
    `refresh-tank-specs: ${rows} tank(s) in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("refresh-tank-specs failed:", error);
    process.exit(1);
  });
