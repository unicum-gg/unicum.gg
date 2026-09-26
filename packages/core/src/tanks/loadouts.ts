import { and, eq, inArray, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  activeLayout,
  crewSkillNames,
  fieldModNames,
  isSkillTree,
  loadoutPrivacy,
  premiumShellShare,
  shellsLoaded,
  tankLoadoutsByRegion,
  type StoredPlayerLoadout,
  type PlayerLoadout,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * Reading and writing how players have set their vehicles up.
 *
 * Every row here was sent by the unicum.gg mod from a player's own client.
 * Wargaming publishes nothing of this, so there is no other source and nothing
 * to reconcile against: what we hold is what a player's client last told us,
 * and the write path's only job is to keep it current without letting anyone
 * write in somebody else's name (see the endpoint, which proves the account
 * against Wargaming before calling any of this).
 */

/**
 * The names actually fitted, for a flat column.
 *
 * The slots themselves keep their positions in the `setups` json. Here an
 * empty slot is simply absent: a text[] holding nulls is not what anyone asks
 * this column, which only ever answers containment ("who runs this"), and
 * drizzle's `text().array()` cannot express a nullable element anyway.
 */
function filled(slots: (string | null)[] | undefined): string[] | null {
  if (!slots) return null;
  return slots.filter((name): name is string => Boolean(name));
}

/** How many vehicles one upload may carry. A full carousel is a few hundred. */
export const MAX_LOADOUTS_PER_UPLOAD = 600;

/**
 * Replace this account's loadouts for the vehicles named, and only those.
 *
 * An upload is a statement about the vehicles it carries, never about the ones
 * it leaves out: the mod sends what has changed since it last spoke, so a
 * vehicle missing from this batch means "unchanged", not "sold". Rows are
 * dropped by `forgetTankLoadouts` when the player really does part with one.
 *
 * The flat columns are derived here rather than sent by the mod, so the
 * client and the aggregates cannot drift apart: a mod that computed its own
 * premium share slightly differently would poison the population figure for
 * everyone, and only for the players running that version.
 */
export async function saveTankLoadouts(
  region: Region,
  accountId: number,
  loadouts: PlayerLoadout[],
): Promise<number> {
  if (loadouts.length === 0) return 0;
  const table = tankLoadoutsByRegion[region];
  const now = new Date();
  const rows = loadouts.map((loadout) => {
    const ammo = activeLayout(loadout.setups?.ammo);
    const devices = activeLayout(loadout.setups?.devices);
    const progression = loadout.progression;
    return {
      accountId,
      tankId: loadout.tankId,
      optDevices: filled(devices?.optDevices),
      consumables: filled(ammo?.consumables),
      boosters: filled(devices?.boosters),
      crewSkills: crewSkillNames(loadout.crew),
      fieldMods: fieldModNames(progression),
      fieldModLevel:
        progression && !isSkillTree(progression) ? progression.level : null,
      premiumShellShare: premiumShellShare(ammo),
      shellsLoaded: shellsLoaded(ammo),
      modules: loadout.modules ?? null,
      crew: loadout.crew ?? null,
      progression: progression ?? null,
      setups: loadout.setups ?? null,
      updatedAt: now,
    };
  });
  await db
    .insert(table)
    .values(rows)
    .onConflictDoUpdate({
      target: [table.accountId, table.tankId],
      set: {
        optDevices: sql`excluded.opt_devices`,
        consumables: sql`excluded.consumables`,
        boosters: sql`excluded.boosters`,
        crewSkills: sql`excluded.crew_skills`,
        fieldMods: sql`excluded.field_mods`,
        fieldModLevel: sql`excluded.field_mod_level`,
        premiumShellShare: sql`excluded.premium_shell_share`,
        shellsLoaded: sql`excluded.shells_loaded`,
        modules: sql`excluded.modules`,
        crew: sql`excluded.crew`,
        progression: sql`excluded.progression`,
        setups: sql`excluded.setups`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
  return rows.length;
}

/** Forget the loadouts of vehicles this account no longer owns. */
export async function forgetTankLoadouts(
  region: Region,
  accountId: number,
  tankIds: number[],
): Promise<number> {
  if (tankIds.length === 0) return 0;
  const table = tankLoadoutsByRegion[region];
  const rows = await db
    .delete(table)
    .where(
      and(eq(table.accountId, accountId), inArray(table.tankId, tankIds)),
    )
    .returning({ tankId: table.tankId });
  return rows.length;
}

/** One player's setup on one vehicle, or null when we have never seen it. */
export async function getTankLoadout(
  region: Region,
  accountId: number,
  tankId: number,
): Promise<StoredPlayerLoadout | null> {
  const table = tankLoadoutsByRegion[region];
  const [row] = await db
    .select({
      tankId: table.tankId,
      modules: table.modules,
      crew: table.crew,
      progression: table.progression,
      setups: table.setups,
      updatedAt: table.updatedAt,
    })
    .from(table)
    .where(and(eq(table.accountId, accountId), eq(table.tankId, tankId)))
    .limit(1);
  if (!row) return null;
  return {
    tankId: row.tankId,
    modules: (row.modules as StoredPlayerLoadout["modules"]) ?? undefined,
    crew: (row.crew as StoredPlayerLoadout["crew"]) ?? undefined,
    progression:
      (row.progression as StoredPlayerLoadout["progression"]) ?? undefined,
    setups: (row.setups as StoredPlayerLoadout["setups"]) ?? undefined,
    updatedAt: row.updatedAt,
  };
}

/** Which of this account's vehicles we hold a loadout for, and how fresh. */
export async function listLoadoutStamps(
  region: Region,
  accountId: number,
): Promise<Map<number, Date>> {
  const table = tankLoadoutsByRegion[region];
  const rows = await db
    .select({ tankId: table.tankId, updatedAt: table.updatedAt })
    .from(table)
    .where(eq(table.accountId, accountId));
  return new Map(rows.map((row) => [row.tankId, row.updatedAt]));
}

/**
 * Whether this player asked for their loadouts not to be shown.
 *
 * The rows are kept either way: hiding governs attribution, not collection, so
 * the population figures a hidden player contributes to keep their sample and
 * nobody can be told which loadout was theirs.
 */
export async function isLoadoutHidden(
  wargamingAccount: string,
): Promise<boolean> {
  const [row] = await db
    .select({ hidden: loadoutPrivacy.hidden })
    .from(loadoutPrivacy)
    .where(eq(loadoutPrivacy.wargamingAccount, wargamingAccount))
    .limit(1);
  return row?.hidden ?? false;
}

/** Record this player's choice about showing their loadouts. */
export async function setLoadoutHidden(
  wargamingAccount: string,
  userId: string,
  hidden: boolean,
): Promise<void> {
  await db
    .insert(loadoutPrivacy)
    .values({ wargamingAccount, userId, hidden, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: loadoutPrivacy.wargamingAccount,
      set: { hidden, userId, updatedAt: new Date() },
    });
}
