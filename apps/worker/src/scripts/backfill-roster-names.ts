// Recover former nicknames from mirrored tournament rosters.
//
//   pnpm --filter @unicum.gg/worker backfill-roster-names [eu|na|asia]
//
// `player_name_history` only grows forwards on its own (a trigger catches a
// rename as it happens), so it knows nothing from before we tracked an account.
// Rosters are dated observations going back to 2018 and fill that gap. One
// statement per region, and re-running it is a no-op: it only inserts names the
// history does not already hold.
import { regionArgs } from "./args";
import { backfillRosterNames } from "@unicum.gg/core/tournaments/names";

async function main(): Promise<void> {
  for (const region of regionArgs()) {
    const at = Date.now();
    const recovered = await backfillRosterNames(region);
    console.log(
      `[roster-names-${region}] ${recovered} former names recovered in ` +
        `${Math.round((Date.now() - at) / 1000)}s`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[roster-names] failed:", err);
  process.exit(1);
});
