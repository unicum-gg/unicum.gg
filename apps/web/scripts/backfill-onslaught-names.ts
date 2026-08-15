// One-shot: materialize the current identity of Onslaught-ranked players and
// seed player name-history from the standings. Idempotent, safe to re-run.
//   pnpm --filter @unicum.gg/web exec tsx --env-file=.env.local scripts/backfill-onslaught-names.ts
import { reconcileOnslaught } from "@unicum.gg/core/wargaming/wot/players/onslaught";
import { REGIONS } from "@unicum.gg/wargaming";

async function main() {
  for (const region of REGIONS) {
    const { resolved, formerNames } = await reconcileOnslaught(region);
    console.log(
      `[${region}] current identities resolved: ${resolved}, former names inserted: ${formerNames}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
