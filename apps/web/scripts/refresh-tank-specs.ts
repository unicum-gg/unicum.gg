// One-shot: re-parse the vehicle catalogue and rewrite tank_specs, including the
// new per-tier free-XP breakdown (free_xp_by_tier). Idempotent, safe to re-run;
// this is exactly what the vehicles cron does daily.
//   pnpm --filter @unicum.gg/web exec tsx --env-file=.env.local scripts/refresh-tank-specs.ts
import { refreshTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";

async function main() {
  const written = await refreshTankSpecs();
  console.log(`tank_specs rewritten: ${written} tanks`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
