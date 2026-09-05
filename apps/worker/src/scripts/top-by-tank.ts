// Run the nightly per-tank pass by hand, outside the cron.
//
//   pnpm --filter @unicum.gg/worker top-by-tank [eu|na|asia]
//
// One walk of `*_tank_snapshots` rebuilds three things: the per-tank
// leaderboard, the server averages behind the tank pages, and the win-rate grid
// the servers page draws (`players/tier-winrate`). Reach for it to fill a table
// the first time, when a new column would otherwise stay empty until 03:30,
// rather than waiting a night for it.
//
// It is the heaviest job we run: it streams the largest table we have from end
// to end, on a forced index scan, so give it hours and prefer a quiet region.
// Naming a region is the usual call, since with no argument it does all three
// in sequence. It also takes no `cron_leader` lease (it calls the recompute
// directly, like every other script here), so starting it near the cron's own
// 03:30 puts two of these cursors on the shared pool and leaves the tables it
// rewrites to whichever finishes last.
import { recomputeTopPlayersByTank } from "@unicum.gg/core/wargaming/wot/players/top/by-tank/cron";
import { isRegion, REGIONS, type Region } from "@unicum.gg/wargaming";

function targets(): Region[] {
  const arg = process.argv[2];
  if (!arg) return [...REGIONS];
  if (!isRegion(arg)) {
    console.error(`top-by-tank: unknown region "${arg}"`);
    process.exit(1);
  }
  return [arg];
}

async function main(): Promise<void> {
  // Sequentially, like the cron: three of these at once would put three full
  // scans of the biggest table on the shared pool.
  for (const region of targets()) {
    const start = Date.now();
    const tanks = await recomputeTopPlayersByTank(region);
    console.log(
      `top-by-tank: ${region} ranked ${tanks} tanks in ${Date.now() - start}ms`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[top-by-tank] failed:", err);
  process.exit(1);
});
