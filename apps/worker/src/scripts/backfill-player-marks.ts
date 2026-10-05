// Seed the Marks of Excellence board from the marks already stored in the tank
// snapshots.
//
//   pnpm --filter @unicum.gg/worker backfill-player-marks [eu|na|asia] \
//     [--from PLAYER_ID] [--limit N]
//
// From here on the portal refresh is the only writer of `*_player_marks`, but
// it only ever runs for an account somebody looks up, so without this pass the
// board spends weeks publishing a top that is really a list of whoever was
// searched for recently. Every on-demand refresh since marks shipped wrote them
// onto that cycle's snapshots, so the data is already here.
//
// Deliberate, not a cron: measured on EU it is about 86 seconds per three
// thousand accounts over 1.6 million of them, so roughly thirteen hours per
// region, against the largest table we have. Same class of job as
// `enumerate-tournaments`, and resumable the same way: it prints the cursor to
// pass back as `--from`. Re-running from the start is safe (every write is an
// upsert), just slower than resuming.
import { numberArg, regionArgs } from "./args";
import { backfillPlayerMarks } from "@unicum.gg/core/players/mark-backfill";

async function main(): Promise<void> {
  const regions = regionArgs();
  const from = numberArg("--from");
  const limit = numberArg("--limit");
  // A cursor is a position in ONE region's `players.id` sequence, and the three
  // regions number theirs independently, so resuming without naming a region
  // would hand an EU offset to NA and Asia and silently skip the accounts below
  // it there.
  if (from !== undefined && regions.length > 1) {
    console.error(
      "--from names a position in one region's players.id sequence: pass the " +
        "region too, e.g. `backfill-player-marks eu --from 420000`.",
    );
    process.exit(1);
  }

  const start = Date.now();
  for (const region of regions) {
    const at = Date.now();
    const result = await backfillPlayerMarks(region, {
      from,
      limit,
      onProgress: ({ cursor, examined, written, withThreeMarks }) => {
        process.stdout.write(
          `[backfill-player-marks-${region}] at ${cursor}: ${examined} examined, ` +
            `${written} written, ${withThreeMarks} with a three-mark gun\n`,
        );
      },
    });
    console.log(
      `[backfill-player-marks-${region}] done in ` +
        `${Math.round((Date.now() - at) / 1000)}s: ${result.examined} examined, ` +
        `${result.written} written, ${result.withThreeMarks} with a three-mark gun, ` +
        `resume with --from ${result.cursor}`,
    );
  }
  console.log(
    `backfill-player-marks: finished in ${Math.round(
      (Date.now() - start) / 1000,
    )}s`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-player-marks] failed:", err);
  process.exit(1);
});
