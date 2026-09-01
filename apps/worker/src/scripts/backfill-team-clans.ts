// Attribute every mirrored tournament team to the clan behind it.
//
//   pnpm --filter @unicum.gg/worker backfill-team-clans [eu|na|asia] [--limit N]
//
// Local work only, no Wargaming call: each team's roster is matched against clan
// membership as of the day the tournament was played. Safe to interrupt and
// re-run, since each tournament is stamped as it completes.
import { REGIONS, isRegion, type Region } from "@unicum.gg/wargaming";
import { backfillTeamClans } from "@unicum.gg/core/tournaments/clans";

function parseArgs(): { regions: Region[]; limit?: number } {
  const args = process.argv.slice(2);
  const limitAt = args.indexOf("--limit");
  const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : undefined;
  const named = args.filter((a) => isRegion(a)) as Region[];
  return { regions: named.length > 0 ? named : [...REGIONS], limit };
}

async function main(): Promise<void> {
  const { regions, limit } = parseArgs();
  for (const region of regions) {
    const at = Date.now();
    const result = await backfillTeamClans(region, {
      limit,
      onProgress: (done, attributed) => {
        process.stdout.write(
          `[team-clans-${region}] ${done} tournaments, ${attributed} teams attributed\n`,
        );
      },
    });
    console.log(
      `[team-clans-${region}] done in ${Math.round((Date.now() - at) / 1000)}s: ` +
        `${result.tournaments} tournaments, ${result.attributed} teams attributed` +
        (result.failed > 0 ? `, ${result.failed} failed` : ""),
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[team-clans] failed:", err);
  process.exit(1);
});
