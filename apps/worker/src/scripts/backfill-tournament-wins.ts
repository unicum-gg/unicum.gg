// Rebuild every player's and every clan's tournament honours from the brackets.
//
//   pnpm --filter @unicum.gg/worker backfill-tournament-wins [eu|na|asia]
//
// Local work only, no Wargaming call. Idempotent: it recomputes from the
// brackets rather than incrementing, and clears the accounts that hold a count
// nothing supports any more, so a run always leaves the column agreeing with
// the archive whatever it held before.
import { regionArgs } from "./args";
import { backfillTournamentWins } from "@unicum.gg/core/tournaments/winners";

async function main(): Promise<void> {
  for (const region of regionArgs()) {
    const at = Date.now();
    const { accounts, clans } = await backfillTournamentWins(region);
    console.log(
      `[tournament-wins-${region}] done in ${Math.round((Date.now() - at) / 1000)}s: ` +
        `${accounts} accounts and ${clans} clans hold at least one win`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[tournament-wins] failed:", err);
  process.exit(1);
});
