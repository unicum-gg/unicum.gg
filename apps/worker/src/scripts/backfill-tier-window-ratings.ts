// Seed the per-tier-floor ratings the recent player boards rank by.
//
//   pnpm --filter @unicum.gg/worker backfill-tier-window-ratings [eu|na|asia] \
//     [--from PLAYER_ID] [--limit N] [--stale-before ISO_DATE]
//
// The snapshot path writes `*_player_tier_window_ratings` on each account's
// next battle, so without this pass the 30-day boards would miss everybody who
// has not played since the tier floors shipped. Run once after the migration
// that created the table (0132), then the hourly top-players pass can rank on
// it. Resumable: it prints the cursor to pass back as `--from`, and re-running
// from the start is safe since every write replaces the account's rows.
//
// `--stale-before` is for after a deploy that changes how a window is
// computed: it rewrites every account that played in the last 30 days but not
// since that instant, the board rows and the player row's window columns
// alike, since nothing else would until each of them plays again.
import { numberArg, regionArgs } from "./args";
import { backfillTierWindowRatings } from "@unicum.gg/core/players/window-ratings-backfill";

async function main(): Promise<void> {
  const regions = regionArgs();
  const from = numberArg("--from");
  const limit = numberArg("--limit");
  const staleAt = process.argv.indexOf("--stale-before");
  const staleBefore = staleAt < 0 ? undefined : new Date(process.argv[staleAt + 1] ?? "");
  if (staleBefore && Number.isNaN(staleBefore.getTime())) {
    console.error("--stale-before takes an ISO date, e.g. 2026-11-09T04:37:08Z.");
    process.exit(1);
  }
  // A cursor is a position in ONE region's `players.id` sequence.
  if (from !== undefined && regions.length > 1) {
    console.error(
      "--from names a position in one region's players.id sequence: pass the " +
        "region too, e.g. `backfill-tier-window-ratings eu --from 420000`.",
    );
    process.exit(1);
  }

  for (const region of regions) {
    const at = Date.now();
    const result = await backfillTierWindowRatings(region, {
      from,
      limit,
      staleBefore,
      onProgress: ({ cursor, examined, written }) => {
        process.stdout.write(
          `[backfill-tier-window-ratings-${region}] at ${cursor}: ${examined} examined, ${written} written\n`,
        );
      },
    });
    console.log(
      `[backfill-tier-window-ratings-${region}] done in ` +
        `${Math.round((Date.now() - at) / 1000)}s: ${result.examined} examined, ` +
        `${result.written} written, resume with --from ${result.cursor}`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-tier-window-ratings] failed:", err);
  process.exit(1);
});
