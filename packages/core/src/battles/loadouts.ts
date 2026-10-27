import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  LOADOUT_SOURCE,
  activeLayout,
  battleLoadoutsByRegion,
  battlesByRegion,
  crewSkillNames,
  premiumShellShare,
  shellsLoaded,
  type NewBattleLoadoutRow,
  type ReplayContainer,
  type ReplayLoadout,
} from "@unicum.gg/shared";
import {
  readFieldMods,
  readLoadouts,
  readReplay,
} from "@unicum.gg/shared";
import { db } from "../db";
import { fetchReplay } from "./replays";

/**
 * Write down the loadouts a replay carries, one row per vehicle per life.
 *
 * Called once, when the file arrives, and never on a read. The alternative was
 * to decode the loadout again every time somebody opened the battle, which
 * costs a decryption and an inflate of about a megabyte to answer a question
 * whose answer never changes. It also makes the loadout available to the
 * battle's own page without that page having to fetch and parse a replay, and
 * to an aggregate without it having to touch the bucket at all.
 *
 * **More than one player's, which was a surprise worth writing down.** The
 * public information the server broadcasts about a vehicle is stripped of its
 * devices, so for a while this looked like one equipped vehicle per file. It is
 * not. When a player dies and follows a team mate, their client is sent that
 * vehicle's own MY_VEHICLE property set, devices and crew and ammunition
 * included. One ordinary random battle yielded six complete loadouts that way:
 * the recorder's Chieftain and five team mates', including two players on the
 * same Strv 103B carrying DIFFERENT devices and different crews, which is what
 * proves these are really theirs and not an echo of the reader's own.
 *
 * Team mates only, because following an enemy is not something the game offers.
 *
 * The set is therefore keyed on the vehicle, and every row is attributed by the
 * battle's own results rather than assumed to be the uploader's.
 */
export async function storeBattleLoadouts(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
  loadouts: ReplayLoadout[],
  clientVersion: string | null,
  /** The header's field modifications, by vehicle. See `readFieldMods`. */
  fieldMods: Map<number, number[]> = new Map(),
): Promise<number> {
  if (loadouts.length === 0 && fieldMods.size === 0) return 0;

  const named = await vehiclesOf(region, arenaUniqueId, startedAt);

  // Ordered by their own clock, so that what survives of a repeated loadout is
  // the first time it was seen, and so lives count the way they were played
  // rather than the way the packets happened to be walked.
  const ordered = [...loadouts].sort((a, b) => a.at - b.at);

  // The property set is RE-SENT, not sent once. Following a team mate delivers
  // theirs again on every switch back to them, and one real battle sent the
  // same vehicle's unchanged loadout four times. Counting those as lives would
  // invent four lives, and -- because `life` is in the primary key -- store the
  // same loadout four times under four different keys, where no conflict rule
  // could catch it. So a loadout counts only when it DIFFERS from the last one
  // seen for that vehicle, which is also exactly what a respawn produces.
  const lastSeen = new Map<number, string>();
  const distinct: typeof ordered = [];
  for (const entry of ordered) {
    const shape = JSON.stringify([entry.setups, entry.crew]);
    if (lastSeen.get(entry.entityId) === shape) continue;
    lastSeen.set(entry.entityId, shape);
    distinct.push(entry);
  }

  // How many distinct loadouts each vehicle showed, which is what decides
  // whether its tank can be named. See `tankId` below.
  const lives = new Map<number, number>();
  for (const entry of distinct) {
    lives.set(entry.entityId, (lives.get(entry.entityId) ?? 0) + 1);
  }

  const seen = new Map<number, number>();

  const rows: NewBattleLoadoutRow[] = distinct.map((life) => {
    const packed = fieldMods.get(life.entityId);
    const index = seen.get(life.entityId) ?? 0;
    seen.set(life.entityId, index + 1);

    const ammo = activeLayout(life.setups?.ammo);
    const devices = activeLayout(life.setups?.devices);
    const vehicle = named.get(life.entityId);
    const optDevices = devices?.optDevices ?? [];

    return {
      startedAt,
      arenaUniqueId,
      vehicleId: life.entityId,
      life: index,
      accountId: vehicle?.account ?? null,
      // Named only when this vehicle had ONE life in this battle.
      //
      // The tank comes from the battle's results, which hold one entry per
      // vehicle and so name the tank it finished in. For a battle without
      // respawns that is the only tank it ever drove and the value is exact.
      // For a vehicle that respawned, every life but one was driven in a
      // different tank, and writing the final one against all of them would
      // attribute a loadout to a tank that never carried it -- figures that
      // look right and are wrong, which is worse than a gap. Reading the tank
      // per life means decoding each respawn out of the recording, which is
      // the work this null waits for.
      tankId: (lives.get(life.entityId) ?? 0) === 1 ? (vehicle?.tank ?? null) : null,
      clientVersion,
      source: LOADOUT_SOURCE.replay,
      optDevices,
      // Sorted and joined so the TRIO can be grouped on. Nulls dropped here
      // and only here: as a key, "a rammer and a turbo" is one thing however
      // the two were arranged, while the positional column above keeps the
      // arrangement because a device's grade depends on its slot.
      devicesTriple: optDevices.filter((name): name is string => Boolean(name))
        .sort()
        .join("+") || null,
      boosters: devices?.boosters ?? [],
      consumables: ammo?.consumables ?? [],
      crewSkills: crewSkillNames(life.crew),
      // Each skill with the seat that trained it. The column this table exists
      // for: for the five skills every seat can learn, how many of the crew
      // trained it is the whole effect, and a deduplicated list turns that
      // into a single boolean.
      crewRoleSkills: (life.crew ?? []).flatMap((member) =>
        member.skills.map((skill) => `${member.role}:${skill}`),
      ),
      premiumShellShare: premiumShellShare(ammo),
      shellsLoaded: ammo ? shellsLoaded(ammo) : null,
      ...(packed ? { fieldModsPacked: packed } : {}),
      crew: life.crew ?? null,
      shells: ammo?.shells ?? null,
    };
  });

  // And a row for every OTHER vehicle the header named modifications for.
  //
  // Most of them, in practice: a replay carries the fitted loadout of one or
  // two players and the field modifications of everyone who has any, which is
  // about twelve of thirty. Without this the table would hold the modifications
  // of the one player whose loadout we also happened to have, and throw away
  // eleven that were sitting in the same file.
  //
  // Life zero, because the header states one set per vehicle for the whole
  // battle and has nothing to say about respawns.
  const written = new Set(rows.map((row) => row.vehicleId));
  for (const [vehicleId, packed] of fieldMods) {
    if (written.has(vehicleId)) continue;
    const vehicle = named.get(vehicleId);
    rows.push({
      startedAt,
      arenaUniqueId,
      vehicleId,
      life: 0,
      accountId: vehicle?.account ?? null,
      // Exact here, unlike on a loadout row: the header names one set of
      // modifications per vehicle, so there is no second life to confuse it
      // with and the results' tank is the right one.
      tankId: vehicle?.tank ?? null,
      clientVersion,
      source: LOADOUT_SOURCE.replay,
      fieldModsPacked: packed,
    });
  }

  const table = battleLoadoutsByRegion[region];

  // On a conflict, fill the gaps and change nothing else.
  //
  // This used to do nothing at all, on the reasoning that a battle has finished
  // and a second offer of the same file cannot know anything the first did not.
  // The reasoning holds for a FACT. It does not hold for a gap, and the
  // difference cost a day of readings: the field modifications were added after
  // some rows had already been written, so a vehicle that had no row got one
  // and a vehicle that HAD a row kept its empty column forever. Since the only
  // vehicle with a row is the one whose loadout we read -- the player who
  // recorded -- the result was a battle showing everyone's field modifications
  // except the recorder's own, which is the one person looking.
  //
  // The same shape recurs whenever a second replay of one battle arrives: it
  // carries the loadout of a vehicle we may know only the modifications of, and
  // that loadout would have been dropped for exactly the same reason.
  //
  // `coalesce(existing, incoming)` keeps whatever is already written, so no
  // fact is ever restated and the rows stay immutable in the sense the schema
  // claims. Only a null moves.
  const fillable = [
    table.accountId,
    table.tankId,
    table.clientVersion,
    table.optDevices,
    table.devicesTriple,
    table.boosters,
    table.consumables,
    table.crewSkills,
    table.crewRoleSkills,
    table.premiumShellShare,
    table.shellsLoaded,
    table.fieldModsPacked,
    table.crew,
    table.shells,
  ];
  const keep = (column: (typeof fillable)[number]) =>
    sql`coalesce(${column}, excluded.${sql.identifier(column.name)})`;

  await db
    .insert(table)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        table.startedAt,
        table.arenaUniqueId,
        table.vehicleId,
        table.life,
      ],
      set: Object.fromEntries(
        fillable.map((column) => [columnKey(table, column), keep(column)]),
      ),
      // And only when there is a gap to fill, so that re-reading an archive
      // does not rewrite every row it already agrees with. A backfill offers
      // the same thousand rows it offered last time; without this each pass
      // would be a thousand row versions for the vacuum to collect.
      setWhere: sql.join(
        fillable.map(
          (column) =>
            sql`(${column} is null and excluded.${sql.identifier(column.name)} is not null)`,
        ),
        sql` or `,
      ),
    });
  return rows.length;
}

/**
 * The property name a column is reached by, which is what `set` is keyed on.
 *
 * Drizzle's `set` takes the TypeScript property (`fieldModsPacked`), not the
 * column name (`field_mods_packed`), and the list above holds columns so that
 * the name, the gap test and the coalesce all come from one place. This maps
 * back, and throws rather than silently skipping a column: a typo here would
 * quietly stop filling one kind of gap, which is the exact failure this whole
 * block exists to undo.
 */
function columnKey(
  table: (typeof battleLoadoutsByRegion)[Region],
  column: { name: string },
): string {
  for (const [key, candidate] of Object.entries(table)) {
    if (
      candidate &&
      typeof candidate === "object" &&
      "name" in candidate &&
      candidate.name === column.name
    ) {
      return key;
    }
  }
  throw new Error(`no property on battle_loadouts for column ${column.name}`);
}

/** The account and tank the battle's own results name for each vehicle. */
async function vehiclesOf(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
): Promise<Map<number, { account?: number; tank: number }>> {
  const table = battlesByRegion[region];
  const [row] = await db
    .select({ vehicles: table.vehicles })
    .from(table)
    .where(
      and(
        eq(table.startedAt, startedAt),
        eq(table.arenaUniqueId, arenaUniqueId),
      ),
    )
    .limit(1);

  const out = new Map<number, { account?: number; tank: number }>();
  for (const vehicle of row?.vehicles ?? []) {
    out.set(vehicle.id, {
      ...(vehicle.account ? { account: vehicle.account } : {}),
      tank: vehicle.tank,
    });
  }
  return out;
}

/**
 * `2.4.0.2` out of `World of Tanks v. 2.4.0.2 #966`.
 *
 * One copy, because three readers need it and they must agree. The column
 * exists to keep one patch's figures apart from another's, and two spellings
 * of one build would split that in half -- a comparison that looks right and
 * compares nothing. The xml version rather than the exe's, which the header
 * also carries but which stops at the release before a hotfix, and with the
 * non-breaking spaces the client writes these with folded to ordinary ones.
 */
export function replayClientVersion(full: string): string | null {
  const found = /v\.\s*([0-9]+(?:\.[0-9]+)+)/.exec(full.replace(/\u00a0/g, " "));
  return found ? found[1] : null;
}

/**
 * Everything one recording says about what its battle was played with.
 *
 * The expensive half -- a decryption and an inflate over about a megabyte --
 * so every caller does it once, and on a path nobody is waiting on.
 *
 * A recording with no packet stream is not a failure: a battle still being
 * played has none yet, and its header already names every vehicle's field
 * modifications, which are worth keeping on their own.
 */
export async function storeLoadoutsFromReplay(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
  bytes: Uint8Array,
): Promise<number> {
  return storeLoadoutsFromContainer(
    region,
    arenaUniqueId,
    startedAt,
    await readReplay(bytes),
  );
}

/**
 * The same, out of a recording already read, so the upload route can decode
 * the file once for the loadouts and the map heatmap together.
 */
export async function storeLoadoutsFromContainer(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
  { blocks, stream }: ReplayContainer,
): Promise<number> {
  const loadouts = stream.length === 0 ? [] : readLoadouts(stream);
  const header = blocks[0] as { clientVersionFromXml?: unknown } | null;
  const version =
    typeof header?.clientVersionFromXml === "string"
      ? replayClientVersion(header.clientVersionFromXml)
      : null;
  return storeBattleLoadouts(
    region,
    arenaUniqueId,
    startedAt,
    loadouts,
    version,
    readFieldMods(blocks),
  );
}

/** What one pass of the backfill did, and where the next one starts. */
export interface LoadoutBackfill {
  /** Battles whose file was opened. */
  read: number;
  /** Battles that yielded at least one row. */
  filled: number;
  /** Rows offered, counting those an existing row already agreed with. */
  rows: number;
  /** Battles whose recording held nothing readable. */
  empty: number;
  /** Battles whose file could not be fetched or read. */
  failed: number;
  /**
   * The last battle's `startedAt`, to hand back as `after`.
   *
   * A cursor rather than a position stored somewhere, so a pass is a pure
   * function of its arguments and can be retried, resumed, or run from
   * anywhere. Null once the sweep has reached the end.
   */
  next: Date | null;
}

/**
 * Re-read archived recordings and write down what they say.
 *
 * Shared by the command line and by the production route, and not for
 * tidiness: the archive answers from inside the deployment and not from a
 * laptop, so the sweep that matters runs on the server while the one that is
 * easy to watch runs locally. Two implementations of that would drift, and the
 * one nobody runs would be the one that is wrong.
 *
 * One file at a time on purpose. Each is about a megabyte off object storage,
 * then a decryption and an inflate; the archive shares a disk with this
 * database, and a backfill is never the most urgent thing running.
 */
export async function backfillBattleLoadouts(
  region: Region,
  options: {
    /** Battles to open in this pass. */
    limit?: number;
    /** Resume point: only battles that started strictly after this. */
    after?: Date | null;
    /** One battle, by arena id, for checking a change rather than sweeping. */
    arenaUniqueId?: string | null;
    /**
     * Only battles that already hold a row with a hole in it.
     *
     * The case this was written for: a fact collected after some rows exist
     * reaches the vehicles that had no row, and never the one that did.
     */
    gapsOnly?: boolean;
    /** Only battles with no row at all, which is the ordinary resumed sweep. */
    missingOnly?: boolean;
    /** Called for each battle that yielded rows. */
    onBattle?: (arenaUniqueId: string, rows: number) => void;
    /** Called for each battle that could not be read. */
    onFailure?: (arenaUniqueId: string, reason: unknown) => void;
  } = {},
): Promise<LoadoutBackfill> {
  const battles = battlesByRegion[region];
  const loadouts = battleLoadoutsByRegion[region];
  const limit = Math.max(1, Math.min(options.limit ?? 25, 500));

  const conditions = [isNotNull(battles.replayKey)];
  if (options.arenaUniqueId) {
    conditions.push(eq(battles.arenaUniqueId, options.arenaUniqueId));
  }
  if (options.after) conditions.push(gt(battles.startedAt, options.after));
  if (options.missingOnly) {
    conditions.push(sql`not exists (
      select 1 from ${loadouts}
      where ${loadouts.startedAt} = ${battles.startedAt}
        and ${loadouts.arenaUniqueId} = ${battles.arenaUniqueId}
    )`);
  }
  if (options.gapsOnly) {
    // A row carrying a loadout and no field modifications. Narrow on purpose:
    // a vehicle that simply has no modifications leaves the same null behind,
    // so a broader test would re-read those files forever. The cursor is what
    // carries a sweep past them.
    conditions.push(sql`exists (
      select 1 from ${loadouts}
      where ${loadouts.startedAt} = ${battles.startedAt}
        and ${loadouts.arenaUniqueId} = ${battles.arenaUniqueId}
        and ${loadouts.optDevices} is not null
        and ${loadouts.fieldModsPacked} is null
    )`);
  }

  const todo = await db
    .select({
      arenaUniqueId: battles.arenaUniqueId,
      startedAt: battles.startedAt,
      key: battles.replayKey,
    })
    .from(battles)
    .where(and(...conditions))
    .orderBy(battles.startedAt)
    .limit(limit);

  const out: LoadoutBackfill = {
    read: 0,
    filled: 0,
    rows: 0,
    empty: 0,
    failed: 0,
    next: null,
  };

  for (const battle of todo) {
    if (!battle.key) continue;
    out.read += 1;
    out.next = battle.startedAt;
    try {
      const file = await fetchReplay(battle.key);
      if (!file) {
        out.failed += 1;
        options.onFailure?.(
          battle.arenaUniqueId,
          `the archive no longer holds ${battle.key}`,
        );
        continue;
      }
      const written = await storeLoadoutsFromReplay(
        region,
        battle.arenaUniqueId,
        battle.startedAt,
        file,
      );
      if (written === 0) {
        out.empty += 1;
        continue;
      }
      out.rows += written;
      out.filled += 1;
      options.onBattle?.(battle.arenaUniqueId, written);
    } catch (error) {
      out.failed += 1;
      options.onFailure?.(battle.arenaUniqueId, error);
    }
  }

  // Null at the end of the sweep, so a caller looping on the cursor stops
  // rather than asking again for a page it has already had.
  if (todo.length < limit) out.next = null;
  return out;
}
