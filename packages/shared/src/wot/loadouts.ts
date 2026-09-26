/**
 * How a player has set a vehicle up, as the unicum.gg mod reads it out of the
 * game client and as the site stores, serves and draws it.
 *
 * These types are the wire contract in both directions, so they follow the
 * CLIENT's own shape rather than a tidier one of our own. Two things about
 * that shape are worth knowing before reading the rest, because both look like
 * mistakes otherwise.
 *
 * **Setups come in two groups, not one, and they move independently.** The
 * client pairs shells with consumables (`ammo`) and optional devices with
 * directives (`devices`), gives each group its own active index, and lets a
 * player unlock a second layout for each through post progression. So a
 * vehicle can be on its second ammunition setup and its first equipment setup
 * at the same time, and asking "which setup is this player on" has two
 * answers.
 *
 * **A slot that is empty is a position, not an absence.** Optional devices and
 * consumables are lists whose index is the slot, so a free slot is a null in
 * the middle rather than a shorter list.
 */

/** A vehicle module: gun, turret, engine, chassis, radio. */
export interface LoadoutModule {
  /** The client's compact descriptor, which is the module's identity. */
  id: number;
  /** The client's own name, scoped to a nation, kept as a readable label. */
  name: string;
}

/** The module every vehicle has, plus the turret the turretless ones do not. */
export interface LoadoutModules {
  gun?: LoadoutModule;
  turret?: LoadoutModule;
  engine?: LoadoutModule;
  chassis?: LoadoutModule;
  radio?: LoadoutModule;
}

/** One kind of round, and how many of them the player loads. */
export interface LoadoutShell {
  id: number;
  name: string;
  /** `ARMOR_PIERCING`, `ARMOR_PIERCING_CR`, `HOLLOW_CHARGE`, `HIGH_EXPLOSIVE`. */
  type: string;
  /** Bought with gold. What "how much premium ammo" is counted from. */
  premium: boolean;
  count: number;
}

/** One layout of the shells-and-consumables group. */
export interface AmmoLayout {
  shells: LoadoutShell[];
  /** Three slots; a free one is null. */
  consumables: (string | null)[];
}

/** One layout of the devices-and-directives group. */
export interface DevicesLayout {
  /** Three slots; a free one is null. */
  optDevices: (string | null)[];
  boosters: (string | null)[];
}

/** A group's layouts and which one the player is on. */
export interface LoadoutSetupGroup<T> {
  /** Index into `layouts`. The client caps a group at two. */
  active: number;
  layouts: T[];
}

export interface LoadoutSetups {
  ammo?: LoadoutSetupGroup<AmmoLayout>;
  devices?: LoadoutSetupGroup<DevicesLayout>;
}

/** One crew member: what they do, and what they have been taught. */
export interface LoadoutCrewMember {
  /** `commander`, `gunner`, `driver`, `radioman`, `loader`. */
  role: string;
  /** Skill names in the order they were learned. */
  skills: string[];
}

/** Field modifications: the level reached and the side of each pair taken. */
export interface LoadoutFieldMods {
  level: number;
  pairs: { name: string; side: "first" | "second" }[];
}

/** A tier XI vehicle's skill tree instead, by the steps received. */
export interface LoadoutSkillTree {
  tree: number[];
}

export type LoadoutProgression = LoadoutFieldMods | LoadoutSkillTree;

export function isSkillTree(
  progression: LoadoutProgression,
): progression is LoadoutSkillTree {
  return "tree" in progression;
}

/** One vehicle's whole setup, as the mod sends it and the page draws it. */
export interface PlayerLoadout {
  /** The vehicle's compact descriptor. */
  tankId: number;
  modules?: LoadoutModules;
  crew?: LoadoutCrewMember[];
  progression?: LoadoutProgression;
  setups?: LoadoutSetups;
}

/** A stored loadout, with when it was last seen. */
export interface StoredPlayerLoadout extends PlayerLoadout {
  updatedAt: Date;
}

/** The layout a group is currently on, or the first one, or nothing. */
export function activeLayout<T>(
  group: LoadoutSetupGroup<T> | undefined,
): T | undefined {
  if (!group || group.layouts.length === 0) return undefined;
  return group.layouts[group.active] ?? group.layouts[0];
}

/**
 * What share of the rounds loaded cost gold, or null when nothing is loaded.
 *
 * Counted over rounds rather than over kinds of round: a player carrying two
 * premium shells beside forty standard ones is not carrying half premium, and
 * the whole point of the figure is how much of the ammunition rack is gold.
 */
export function premiumShellShare(layout: AmmoLayout | undefined): number | null {
  if (!layout) return null;
  let loaded = 0;
  let premium = 0;
  for (const shell of layout.shells) {
    loaded += shell.count;
    if (shell.premium) premium += shell.count;
  }
  return loaded > 0 ? premium / loaded : null;
}

/** Rounds loaded across a layout, for re-weighting a share. */
export function shellsLoaded(layout: AmmoLayout | undefined): number {
  if (!layout) return 0;
  return layout.shells.reduce((total, shell) => total + shell.count, 0);
}

/**
 * Every skill on a crew, once each.
 *
 * Deduplicated because the question this serves is about the vehicle rather
 * than about a member: "do they run Brothers in Arms" is one answer, and a
 * crew of five trains it five times over.
 */
export function crewSkillNames(crew: LoadoutCrewMember[] | undefined): string[] {
  const seen: string[] = [];
  for (const member of crew ?? []) {
    for (const skill of member.skills) {
      if (!seen.includes(skill)) seen.push(skill);
    }
  }
  return seen;
}

/** Field modifications as `name:side`, which is how the flat column holds them. */
export function fieldModNames(
  progression: LoadoutProgression | undefined,
): string[] {
  if (!progression || isSkillTree(progression)) return [];
  return progression.pairs.map((pair) => `${pair.name}:${pair.side}`);
}
