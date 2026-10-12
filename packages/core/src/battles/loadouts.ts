import { and, eq } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  LOADOUT_SOURCE,
  activeLayout,
  battleLoadoutsByRegion,
  battlesByRegion,
  crewSkillNames,
  premiumShellShare,
  shellsLoaded,
  type LoadoutCrewMember,
  type LoadoutShell,
  type NewBattleLoadoutRow,
  type ReplayLoadout,
} from "@unicum.gg/shared";
import { db } from "../db";

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

  // Nothing to update on a conflict. A loadout that was already written is the
  // same loadout: the row is a statement about a battle that has finished, and
  // a second offer of the same file cannot know anything the first did not.
  await db.insert(battleLoadoutsByRegion[region]).values(rows).onConflictDoNothing();
  return rows.length;
}

/** One stored loadout, as a page needs it before the names are resolved. */
export interface StoredBattleLoadout {
  vehicleId: number;
  life: number;
  /** Needed to find this vehicle's catalogue of pictures. */
  tankId: number | null;
  optDevices: (string | null)[];
  boosters: (string | null)[];
  consumables: (string | null)[];
  shells: LoadoutShell[];
  premiumShellShare: number | null;
  crew: LoadoutCrewMember[];
  /** The field modifications, still packed. See `fieldModSlots` to draw them. */
  fieldModsPacked: number[];
}

/**
 * The loadouts stored for one battle, in the order they were played.
 *
 * Found by the battle id alone, which means one extra lookup to learn the
 * partition key: the id is unique on its own, but every index here leads with
 * `started_at` because Postgres requires the partition key in a partitioned
 * table's primary key, so a query without it would scan every month.
 *
 * `tankId` is filled in from the battle's own results where this table left it
 * null, which it does for a vehicle that respawned. A page can draw a loadout
 * without knowing the tank; it just loses the pictures, which come from the
 * vehicle's own catalogue.
 */
export async function readBattleLoadouts(
  region: Region,
  arenaUniqueId: string,
): Promise<StoredBattleLoadout[]> {
  const battles = battlesByRegion[region];
  const [battle] = await db
    .select({ startedAt: battles.startedAt, vehicles: battles.vehicles })
    .from(battles)
    .where(eq(battles.arenaUniqueId, arenaUniqueId))
    .limit(1);
  if (!battle) return [];

  const table = battleLoadoutsByRegion[region];
  const rows = await db
    .select({
      vehicleId: table.vehicleId,
      life: table.life,
      tankId: table.tankId,
      optDevices: table.optDevices,
      boosters: table.boosters,
      consumables: table.consumables,
      shells: table.shells,
      premiumShellShare: table.premiumShellShare,
      crew: table.crew,
      fieldModsPacked: table.fieldModsPacked,
    })
    .from(table)
    .where(
      and(
        eq(table.startedAt, battle.startedAt),
        eq(table.arenaUniqueId, arenaUniqueId),
      ),
    );

  const tanks = new Map(battle.vehicles.map((v) => [v.id, v.tank]));
  return rows
    .sort((a, b) => a.vehicleId - b.vehicleId || a.life - b.life)
    .map((row) => ({
      vehicleId: row.vehicleId,
      life: row.life,
      tankId: row.tankId ?? tanks.get(row.vehicleId) ?? null,
      optDevices: row.optDevices ?? [],
      boosters: row.boosters ?? [],
      consumables: row.consumables ?? [],
      shells: row.shells ?? [],
      premiumShellShare: row.premiumShellShare,
      crew: row.crew ?? [],
      fieldModsPacked: row.fieldModsPacked ?? [],
    }));
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
