/**
 * Read the loadouts out of the replays already in the archive.
 *
 * The upload route decodes a replay's loadouts as the file arrives, but every
 * replay stored before that existed has none: the bytes are in the bucket and
 * nothing has ever looked at them. This walks those battles and fills the gap.
 *
 * Safe to run again. `storeBattleLoadouts` inserts and ignores conflicts, so a
 * second pass over the same battle writes nothing and costs one query; and the
 * battles already carrying loadouts are skipped before their file is fetched,
 * which is what makes a resumed run cheap rather than a full re-download.
 *
 *   pnpm --filter @unicum.gg/web tsx scripts/backfill-battle-loadouts.ts --dry
 *   pnpm --filter @unicum.gg/web tsx scripts/backfill-battle-loadouts.ts
 *   ... --region na --limit 50 --force
 *
 * One file at a time on purpose. Each one is about a megabyte off object
 * storage, then a Blowfish pass and an inflate; the archive shares a disk with
 * this database, and a backfill is never the most urgent thing running.
 */
import { readFieldMods, readLoadouts, readReplay } from "@unicum.gg/shared";
import { isRegion, Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { battleLoadoutsByRegion, battlesByRegion } from "@unicum.gg/shared";
import { fetchReplay } from "@unicum.gg/core/battles/replays";
import { storeBattleLoadouts } from "@unicum.gg/core/battles/loadouts";
import { and, eq, isNotNull, sql } from "drizzle-orm";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
/**
 * Re-read battles that already have rows.
 *
 * The ordinary run skips them, which is what makes a resumed pass cheap. It is
 * also why a run after a new fact is collected -- field modifications were the
 * first -- would add nothing to the battles already seen: they have a row, so
 * they are not looked at. The insert ignores conflicts, so a forced pass
 * rewrites nothing it already holds and fills only what is new.
 */
const force = args.includes("--force");
const value = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};

const asked = value("region");
const regions: Region[] = asked
  ? isRegion(asked)
    ? [asked]
    : (() => {
        console.error(`unknown region: ${asked}`);
        process.exit(1);
      })()
  : [Region.EU, Region.NA, Region.ASIA];
const limit = Number(value("limit") ?? 0) || Infinity;

/**
 * `2.4.0.2` out of `World of Tanks v.2.4.0.2 #966`.
 *
 * The same expression the upload route and the mod both use. Kept in step with
 * them deliberately: the column exists to separate one patch's figures from
 * another's, and two spellings of one build would split it in half.
 */
function clientVersion(full: string): string | null {
  const found = /v\.\s*([0-9]+(?:\.[0-9]+)+)/.exec(full.replace(/ /g, " "));
  return found ? found[1] : null;
}

async function main() {
  let read = 0;
  let filled = 0;
  let rows = 0;
  let empty = 0;
  let failed = 0;

  for (const region of regions) {
    const battles = battlesByRegion[region];
    const loadouts = battleLoadoutsByRegion[region];

    // The battles that have a file and no loadout yet. Asked of the database
    // rather than filtered in memory so a resumed run does not re-download
    // what it already did.
    const todo = await db
      .select({
        arenaUniqueId: battles.arenaUniqueId,
        startedAt: battles.startedAt,
        key: battles.replayKey,
      })
      .from(battles)
      .where(
        force
          ? isNotNull(battles.replayKey)
          : and(
              isNotNull(battles.replayKey),
              sql`not exists (
                select 1 from ${loadouts}
                where ${loadouts.startedAt} = ${battles.startedAt}
                  and ${loadouts.arenaUniqueId} = ${battles.arenaUniqueId}
              )`,
            ),
      )
      .orderBy(battles.startedAt);

    console.log(`${region}: ${todo.length} battle(s) with a replay and no loadout`);

    for (const battle of todo) {
      if (read >= limit) break;
      read += 1;
      if (!battle.key) continue;
      try {
        const file = await fetchReplay(battle.key);
        if (!file) {
          console.warn(`  ${battle.arenaUniqueId}: the archive no longer holds ${battle.key}`);
          failed += 1;
          continue;
        }
        const { blocks, stream } = await readReplay(file);
        if (stream.length === 0) {
          empty += 1;
          continue;
        }
        const found = readLoadouts(stream);
        if (found.length === 0) {
          empty += 1;
          continue;
        }
        const header = blocks[0] as { clientVersionFromXml?: unknown } | null;
        const version =
          typeof header?.clientVersionFromXml === "string"
            ? clientVersion(header.clientVersionFromXml)
            : null;
        if (dry) {
          const players = new Set(found.map((life) => life.entityId)).size;
          console.log(
            `  ${battle.arenaUniqueId}: ${found.length} entr(y|ies), ${players} vehicle(s), ${version ?? "no version"}`,
          );
          filled += 1;
          continue;
        }
        const written = await storeBattleLoadouts(
          region,
          battle.arenaUniqueId,
          battle.startedAt,
          found,
          version,
          readFieldMods(blocks),
        );
        rows += written;
        filled += 1;
        console.log(`  ${battle.arenaUniqueId}: ${written} row(s)`);
      } catch (error) {
        failed += 1;
        console.error(`  ${battle.arenaUniqueId}: failed`, error);
      }
    }
  }

  console.log(
    `\n${dry ? "DRY RUN " : ""}read ${read}, filled ${filled}, ${rows} row(s), ` +
      `${empty} with nothing to read, ${failed} failed`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
