// One-shot: recompute the Onslaught crest columns from the standings and the
// capture history. Idempotent, and `onslaught-crest-cron` does the same thing
// every quarter hour, so this is for a backfill or for checking by hand.
//   cd apps/web && npx tsx --env-file-if-exists=.env.local scripts/refresh-onslaught-crests.ts
import { refreshOnslaughtCrests } from "@unicum.gg/core/wargaming/wot/players/onslaught-crest";
import { REGIONS } from "@unicum.gg/wargaming";

async function main() {
  for (const region of REGIONS) {
    const written = await refreshOnslaughtCrests(region);
    console.log(`[${region}] ${written} player row(s) updated`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
