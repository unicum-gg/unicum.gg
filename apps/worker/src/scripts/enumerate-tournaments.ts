// Recover the tournaments Wargaming serves but no longer lists, by walking the
// id space instead of the catalogue.
//
//   pnpm --filter @unicum.gg/worker enumerate-tournaments [eu|na|asia] \
//     [--from ID] [--to ID] [--limit N]
//
// `--limit` is per region, and `--from`/`--to` need a region named, since an id
// is a position in one region's sequence.
//
// `seed-tournaments` mirrors everything the lobby endpoint lists, and on EU that
// is 525 settled tournaments against roughly 13,000 that exist: the rest were
// dropped from the listing and answer only when asked for by id. Since the ids
// are sequential per region, they can be enumerated, which is what this does.
//
// It walks newest first at the tournament pool's own pace (three requests a
// second against one host), so EU is a night of fetching and NA and Asia have
// almost nothing left to find. Safe to interrupt and re-run: mirrored
// tournaments are skipped, and the cursor it prints is where to resume.
import { numberArg, regionArgs } from "./args";
import { enumerateRegion } from "@unicum.gg/core/tournaments/enumerate";


async function main(): Promise<void> {
  const regions = regionArgs();
  const from = numberArg("--from");
  const to = numberArg("--to");
  const limit = numberArg("--limit");
  // A cursor belongs to one region: the id carries its realm in the leading
  // digits, so resuming with `--from`/`--to` and no region named would hand an
  // EU id to NA and Asia as well. `enumerateRegion` clamps it to each region's
  // own space, so nothing runs away, but the run would silently not be the
  // resume that was asked for.
  if ((from !== undefined || to !== undefined) && regions.length > 1) {
    console.error(
      "--from/--to name a position in one region's id space: pass the region too, " +
        "e.g. `enumerate-tournaments eu --from 5000009000`.",
    );
    process.exit(1);
  }
  const start = Date.now();
  for (const region of regions) {
    const at = Date.now();
    const result = await enumerateRegion(region, {
      from,
      to,
      limit,
      onProgress: ({ scanned, discovered, absent, failed, cursor }) => {
        // One line per 50 ids, so a run measured in hours stays followable
        // without a line per probe.
        if (scanned % 50 === 0) {
          process.stdout.write(
            `[enumerate-tournaments-${region}] at ${cursor}: ${scanned} probed, ` +
              `${discovered} recovered, ${absent} absent, ${failed} failed\n`,
          );
        }
      },
    });
    console.log(
      `[enumerate-tournaments-${region}] done in ${Math.round((Date.now() - at) / 1000)}s: ` +
        `${result.discovered} recovered, ${result.absent} absent, ` +
        `${result.unscheduled} unscheduled, ${result.failed} failed` +
        (result.cursor === null ? "" : `, stopped at ${result.cursor}`),
    );
  }
  console.log(
    `enumerate-tournaments: finished in ${Math.round((Date.now() - start) / 1000)}s`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[enumerate-tournaments] failed:", err);
  process.exit(1);
});
