// Recover the platoons of battles recorded before the mod sent them.
//
//   pnpm --filter @unicum.gg/worker backfill-battle-squads [eu|na|asia]
//
// Reads the stored replay of each battle that has one and no platoon yet, and
// numbers the platoons from the results it carries. Battles without a replay
// cannot be recovered and are left as they are. Re-running it only revisits the
// battles that turned out to have no platoon at all.
import { regionArgs } from "./args";
import { backfillBattleSquads } from "@unicum.gg/core/battles/squads-backfill";

async function main(): Promise<void> {
  for (const region of regionArgs()) {
    const at = Date.now();
    const stats = await backfillBattleSquads(region, (line) =>
      console.log(`[battle-squads-${region}] ${line}`),
    );
    console.log(
      `[battle-squads-${region}] done: ${stats.marked} battles given their ` +
        `platoons, ${stats.none} had none, ${stats.unreadable} unreadable, in ` +
        `${Math.round((Date.now() - at) / 1000)}s`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[battle-squads] failed:", err);
  process.exit(1);
});
