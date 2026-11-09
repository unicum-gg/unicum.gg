import { iconUrl } from "../assets";
import { ITEM_TYPE, splitIntCompactDescr } from "./loadout-catalogue";
import { SHELLS } from "./loadout-shells";

/**
 * The consumables of the game's event modes, by the id a replay carries.
 *
 * Apart from `EQUIPMENTS` because the client keeps them apart: Halloween, Last
 * Stand and Story Mode each ship their own `<mode>/scripts/item_defs/` beside
 * the main one, and none of what they declare is in the main definitions.
 *
 * Each entry is `[name, icon]`. `name` is the key the mode's own
 * `<mode>.artefacts.extend` catalogue names the item under, which is what
 * `game/equipment` is keyed by, and is not always the element's own name (Story
 * Mode's battleship strikes are six elements and one key). `icon` is the file
 * under `artefact/` on the assets mirror, null where the mirror has none.
 *
 * Only the items a catalogue names: the rest are the modes' empty-slot
 * placeholders and scripted strikes, which nobody fits.
 *
 * Generated. Regenerate from the client sources rather than editing by hand.
 */
export const EVENT_EQUIPMENTS: Record<number, readonly [string, string | null]> = {
  14011: ["battleship", null],
  14012: ["battleship", null],
  14013: ["battleship", null],
  14014: ["battleship", null],
  14015: ["battleship", null],
  14016: ["battleship", null],
  14041: ["recon_ability", null],
  14042: ["distraction_ability", null],
  14051: ["scc_airstrike_ability", "sm_scc_airstrike_ability"],
  14052: ["scc_airstrike_ability", "sm_scc_airstrike_ability"],
  20001: ["nitroRamDamage", null],
  20002: ["hpRepairAndCrewHeal", "hw_hpRepairAndCrewHeal"],
  20007: ["teamRepairKit", "hw_teamRepairKit"],
  20008: ["damageShield", "hw_damageShield"],
  20009: ["fastReload", "hw_fastReload"],
  20010: ["hwInvisibility", "hw_invisibility"],
  20012: ["hwAoeDamageInstantShot", "hw_aoeDamageInstantShot"],
  20013: ["hwAoeDrainEnemyHpInstantShot", "hw_aoeDrainEnemyHpInstantShot"],
  20014: ["hwAoeStunInstantShot", "hw_aoeStunInstantShot"],
  21001: ["LS_nitro", "ls_nitro"],
  21002: ["LS_selfRepair", "ls_selfRepairKit"],
  21003: ["LS_teamRepair", "ls_teamRepairKit"],
  21004: ["LS_damageShield", "ls_damageShield"],
  21005: ["LS_fastReload", "ls_fastReload"],
  21006: ["LS_invisibility", "ls_invisibility"],
  21007: ["LS_aoeDamageInstantShot", "ls_aoeDamageInstantShot"],
  21008: ["LS_aoeDrainEnemyHpInstantShot", "ls_aoeDrainEnemyHpInstantShot"],
  21009: ["LS_aoeStunInstantShot", "ls_aoeStunInstantShot"],
  21010: ["LS_doubleDamage", "ls_doubleDamage"],
  21011: ["LS_healSituational", "ls_healSituational"],
  21012: ["LS_extraDamageSituational", "ls_extraDamageSituational"],
  21013: ["LS_nitroSituational", "ls_nitroSituational"],
};

/**
 * What a slot holds when the catalogues cannot name it. An unknown id keeps its
 * number under this prefix, so the slot stays plainly occupied and the item can
 * still be recognised once a catalogue learns it.
 */
export const UNKNOWN_ITEM = "unknown:";

/** The kind of a round the catalogues do not hold, which no icon exists for. */
export const UNKNOWN_SHELL = "UNKNOWN";

/**
 * A stored loadout key, resolved against what the catalogues hold today.
 *
 * Loadouts are decoded once, at ingest, so a battle stored before a catalogue
 * learned an item keeps `unknown:<id>` for good. Reading through this means
 * teaching the catalogue is enough, with nothing stored to rewrite.
 */
export function resolveStoredItem(key: string | null): string | null {
  if (!key?.startsWith(UNKNOWN_ITEM)) return key;
  const { type, id } = splitIntCompactDescr(Number(key.slice(UNKNOWN_ITEM.length)));
  if (type !== ITEM_TYPE.equipment) return key;
  return EVENT_EQUIPMENTS[id]?.[0] ?? key;
}

/** A stored round, resolved the same way. Its id survives decoding as a number. */
export function resolveStoredShell<T extends { id: number; type: string }>(shell: T): T {
  if (shell.type !== UNKNOWN_SHELL) return shell;
  const entry = SHELLS[shell.id];
  return entry ? { ...shell, type: entry[1] } : shell;
}

const EVENT_ICONS = new Map(Object.values(EVENT_EQUIPMENTS));

/** An event item's picture, or null for anything else. */
export function eventItemPicture(key: string): string | null {
  const icon = EVENT_ICONS.get(key);
  return icon ? iconUrl(`artefact/${icon}.extend.png`) : null;
}
