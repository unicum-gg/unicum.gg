/**
 * Read the loadouts out of the replays already in the archive.
 *
 * The upload route decodes a replay's loadouts as the file arrives, but every
 * replay stored before that existed has none: the bytes are in the bucket and
 * nothing has ever looked at them. This walks those battles and fills the gap.
 *
 * **It only works where the archive answers.** The bucket is reached on the
 * deployment's own network, so a run from a laptop fetches nothing at all and
 * reports every battle as missing from the archive. This is the version for
 * watching one battle go through; the sweep that matters is the route at
 * `api/cron/backfill-battle-loadouts`, which calls the same function from
 * inside the deployment.
 *
 * Safe to run again. `storeBattleLoadouts` fills the gaps in a row it already
 * holds and restates nothing, so a second pass over the same battle writes only
 * what was missing; and without `--force` the battles that already carry
 * loadouts are skipped before their file is fetched, which is what makes a
 * resumed run cheap rather than a full re-download.
 *
 *   pnpm --filter @unicum.gg/web tsx scripts/backfill-battle-loadouts.ts
 *   ... --region na --limit 50 --force
 *   ... --arena 2339324205223092770
 *   ... --gaps      (only battles whose row has a loadout and no field mods)
 */
import {
  backfillBattleLoadouts,
  type LoadoutBackfill,
} from "@unicum.gg/core/battles/loadouts";
import { isRegion, Region } from "@unicum.gg/wargaming";

const args = process.argv.slice(2);
/**
 * Re-read battles that already have rows.
 *
 * The ordinary run skips them, which is what makes a resumed pass cheap. It is
 * also why a run after a new fact is collected -- field modifications were the
 * first -- adds nothing to the battles already seen: they have a row, so they
 * are not looked at. This is the flag for that case.
 *
 * It did not use to be enough. The insert ignored conflicts outright, so a
 * forced pass re-read every file and then threw away everything it learned
 * about a vehicle that already had a row -- which is always the recorder, the
 * one vehicle whose loadout we have. A battle ended up showing every player's
 * field modifications except the recorder's own. The insert now fills nulls
 * and still restates nothing, so a forced pass does what this always claimed.
 */
const force = args.includes("--force");
/** Narrower than `--force`: only the battles with a hole we can fill. */
const gaps = args.includes("--gaps");
const value = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};

/** One battle, by arena id. It is looked at whatever rows it already has. */
const only = value("arena");
const asked = value("region");
const regions: Region[] = asked
  ? isRegion(asked)
    ? [asked]
    : (() => {
        console.error(`unknown region: ${asked}`);
        process.exit(1);
      })()
  : [Region.EU, Region.NA, Region.ASIA];
const limit = Number(value("limit") ?? 0) || 500;

async function main() {
  const total: LoadoutBackfill = {
    read: 0,
    filled: 0,
    rows: 0,
    empty: 0,
    failed: 0,
    next: null,
  };

  for (const region of regions) {
    console.log(`${region}:`);
    // Paged, and by a cursor rather than one enormous query, so that a run
    // stopped halfway can be resumed from where it left off.
    let after: Date | null = null;
    let read = 0;
    for (;;) {
      const pass: LoadoutBackfill = await backfillBattleLoadouts(region, {
        limit: Math.min(50, limit - read),
        after,
        arenaUniqueId: only,
        gapsOnly: gaps,
        missingOnly: !force && !gaps && !only,
        onBattle: (id, rows) => console.log(`  ${id}: ${rows} row(s)`),
        onFailure: (id, reason) => console.warn(`  ${id}: ${String(reason)}`),
      });
      total.read += pass.read;
      total.filled += pass.filled;
      total.rows += pass.rows;
      total.empty += pass.empty;
      total.failed += pass.failed;
      read += pass.read;
      after = pass.next;
      if (!after || read >= limit) break;
    }
  }

  console.log(
    `\nread ${total.read}, filled ${total.filled}, ${total.rows} row(s), ` +
      `${total.empty} with nothing to read, ${total.failed} failed`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
