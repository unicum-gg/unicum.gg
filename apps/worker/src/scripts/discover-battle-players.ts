// Add every account the stored battles name to the players table.
//
//   pnpm --filter @unicum.gg/worker discover-battle-players [eu|na|asia]
//
// The catch-up for battles stored before ingestion discovered their
// participants. No Wargaming call: the accounts are queued, and the snapshot
// pipeline reads their names. Idempotent, so safe to re-run.
import { regionArgs } from "./args";
import { discoverStoredBattleParticipants } from "@unicum.gg/core/battles/discover";

async function main(): Promise<void> {
  for (const region of regionArgs()) {
    const at = Date.now();
    const added = await discoverStoredBattleParticipants(region);
    console.log(
      `[battle-players-${region}] ${added} accounts added in ${Math.round((Date.now() - at) / 1000)}s`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[battle-players] failed:", err);
  process.exit(1);
});
