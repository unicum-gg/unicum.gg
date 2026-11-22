// Write the first rows of the per-tier Skirmish history from the current
// breakdown.
//
//   pnpm --filter @unicum.gg/worker seed-skirmish-tier-history [eu|na|asia] \
//     [--from PLAYER_ID] [--limit N]
//
// `*_player_skirmish_tiers` cannot reach back past its first row, so without
// this a player's 24h/7d/30d columns by tier start filling on their next
// skirmish; with it, every window is complete once its own length has passed.
// Run once, right after the deploy that ships the table. No Wargaming call: it
// reads `*_tank_modes`. Resumable from the printed cursor, and re-running is
// harmless, since a tier already recorded at the same total writes nothing.
import { numberArg, regionArgs } from "./args";
import { seedSkirmishTierHistory } from "@unicum.gg/core/players/skirmish-tier-history";

async function main(): Promise<void> {
  const regions = regionArgs();
  const from = numberArg("--from");
  const limit = numberArg("--limit");
  // A cursor is a position in ONE region's `players.id` sequence.
  if (from !== undefined && regions.length > 1) {
    console.error(
      "--from names a position in one region's players.id sequence: pass the " +
        "region too, e.g. `seed-skirmish-tier-history eu --from 420000`.",
    );
    process.exit(1);
  }

  for (const region of regions) {
    const at = Date.now();
    const result = await seedSkirmishTierHistory(region, {
      from,
      limit,
      onProgress: ({ cursor, examined, written }) => {
        process.stdout.write(
          `[seed-skirmish-tier-history-${region}] at ${cursor}: ` +
            `${examined} examined, ${written} written\n`,
        );
      },
    });
    console.log(
      `[seed-skirmish-tier-history-${region}] done in ` +
        `${Math.round((Date.now() - at) / 1000)}s: ${result.examined} examined, ` +
        `${result.written} written, resume with --from ${result.cursor}`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-skirmish-tier-history] failed:", err);
  process.exit(1);
});
