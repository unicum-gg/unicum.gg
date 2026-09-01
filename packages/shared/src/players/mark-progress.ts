import type { TankStats } from "../wot/tank-stats";
import type { PlayerTankRow } from "./tanks";

/**
 * What a player has marked, what they have mastered, and where the two
 * disagree.
 *
 * The last part is the one worth having. Counting marks is an inventory anyone
 * can read off the garage, while comparing a vehicle's marks against the bar
 * the player's own combined damage clears on it says something they cannot see
 * in the client: which guns are behind the hands driving them.
 *
 * Everything here is pure. The profile endpoint already holds the garage (for
 * the vehicle rows and the account valuation) and the region's thresholds are a
 * cached catalogue read, so the whole panel costs the page arithmetic rather
 * than a query of its own.
 */

/** Combined-damage thresholds for the three Marks of Excellence on one tank. */
export type MarkThresholds = { mark1: number; mark2: number; mark3: number };

/** How many of a player's vehicles sit at each mark level, for one tier. */
export type MarksTierRow = {
  tier: number;
  /** Vehicles carrying no mark yet. */
  none: number;
  mark1: number;
  mark2: number;
  mark3: number;
  total: number;
};

/** Same, for the Mark of Mastery badges. */
export type MasteryTierRow = {
  tier: number;
  none: number;
  class3: number;
  class2: number;
  class1: number;
  ace: number;
  total: number;
};

/**
 * Which average the reach estimate was computed over.
 *
 * Wargaming scores a mark on a rolling window of recent battles, so the last 30
 * days are the closer analogue. A vehicle the player has barely touched this
 * month has no meaningful recent average, and falls back to its lifetime one.
 */
export enum MarkWindow {
  Recent = "recent",
  Lifetime = "lifetime",
}

/**
 * A vehicle the player performs above their marks on.
 *
 * The comparison is between two things the player already owns: the marks on
 * the gun, and where their own combined damage sits against the region's bars
 * for that vehicle. A gun with no mark whose average clears the two-mark bar is
 * not a vehicle to grind, it is a mark the player has already earned the
 * numbers for and simply has not converted, which is the actionable half.
 */
export type MarkReachEntry = {
  tankId: number;
  slug: string | null;
  name: string;
  tier: number;
  /** Vehicle identity the row's icon needs, same fields the lift/drag rows
   * carry. Non-null: a vehicle missing from the encyclopedia has no name or
   * tier either, and is left out below like lift/drag leaves it out. */
  tag: string;
  type: string;
  isPremium: boolean;
  /** Marks already on the gun, 0 to 2 (a 3-mark gun has nothing left to chase). */
  marks: number;
  /** The highest mark this vehicle's average already clears, 1 to 3. Always
   * greater than `marks`, which is what puts the entry in this list. */
  playingAt: number;
  /** Combined damage the region asks for `playingAt` on this vehicle. */
  threshold: number;
  /** The player's own combined damage over `window`. */
  combined: number;
  /** `combined` over the bar for the very next mark (`marks + 1`), so a
   * progress bar has something to fill. At least 1 by construction. */
  ratio: number;
  /** Battles the average covers. */
  battles: number;
  window: MarkWindow;
};

export type PlayerMarkProgress = {
  /** Vehicles in the garage the panel counts over: every one the encyclopedia
   * places at a tier. Both panels divide by this, since "vehicles whose badge
   * we know" and "vehicles whose marks we know" are different sets and neither
   * is the garage. */
  garage: number;
  marks: {
    /** Vehicles carrying exactly one, two, three marks. */
    total: { mark1: number; mark2: number; mark3: number };
    byTier: MarksTierRow[];
    /** Vehicles whose mark count we know. Marks come from the WoT portal rather
     * than the public API, so a player we have never refreshed on demand has
     * none of them and the panel says so instead of reading as "no marks". */
    known: number;
  };
  mastery: {
    total: { class3: number; class2: number; class1: number; ace: number };
    byTier: MasteryTierRow[];
  };
  /** Vehicles whose average already clears a mark they do not have, widest gap
   * first. */
  reach: MarkReachEntry[];
};

/**
 * Battles a vehicle needs before its average says anything. A handful of lucky
 * games on a tier 10 would otherwise top the reach list ahead of vehicles the
 * player actually plays.
 */
const MIN_TANK_BATTLES = 25;

/** Battles the 30-day window needs before it is preferred over the lifetime
 * average. Below this the recent number is noisier than the one it replaces. */
const MIN_WINDOW_BATTLES = 20;

/** How many reach entries the payload carries. The panel shows a handful; the
 * rest are there so a client-side filter has something to work with. */
const REACH_LIMIT = 12;

/** The site's combined damage: dealt plus both assist channels, matching
 * `buildPlayerDerivedStats` so the profile never shows two different numbers
 * under the same name. */
function combinedDamage(t: TankStats): number {
  return (
    t.all.damage_dealt +
    t.all.radio_assisted_damage +
    t.all.track_assisted_damage
  );
}

function emptyMarksRow(tier: number): MarksTierRow {
  return { tier, none: 0, mark1: 0, mark2: 0, mark3: 0, total: 0 };
}

function emptyMasteryRow(tier: number): MasteryTierRow {
  return { tier, none: 0, class3: 0, class2: 0, class1: 0, ace: 0, total: 0 };
}

const MARK_KEY = ["none", "mark1", "mark2", "mark3"] as const;
const MASTERY_KEY = ["none", "class3", "class2", "class1", "ace"] as const;

export function buildPlayerMarkProgress(
  vehicles: PlayerTankRow[],
  tanks: TankStats[],
  recentTanks: TankStats[] | null,
  thresholds: Map<number, MarkThresholds>,
): PlayerMarkProgress {
  const marksByTier = new Map<number, MarksTierRow>();
  const masteryByTier = new Map<number, MasteryTierRow>();
  const marksTotal = { mark1: 0, mark2: 0, mark3: 0 };
  const masteryTotal = { class3: 0, class2: 0, class1: 0, ace: 0 };
  let known = 0;
  let garage = 0;

  for (const v of vehicles) {
    if (v.tier == null) continue;
    garage += 1;

    if (v.moe != null && Number.isInteger(v.moe) && v.moe >= 0 && v.moe <= 3) {
      known += 1;
      const row = marksByTier.get(v.tier) ?? emptyMarksRow(v.tier);
      row[MARK_KEY[v.moe]] += 1;
      row.total += 1;
      marksByTier.set(v.tier, row);
      if (v.moe > 0) {
        marksTotal[MARK_KEY[v.moe] as "mark1" | "mark2" | "mark3"] += 1;
      }
    }

    // Mastery comes from the public API, so it is set on every vehicle we have
    // ever sampled; a null is a pre-migration snapshot, not "no badge".
    if (
      v.mom != null &&
      Number.isInteger(v.mom) &&
      v.mom >= 0 &&
      v.mom <= 4
    ) {
      const row = masteryByTier.get(v.tier) ?? emptyMasteryRow(v.tier);
      row[MASTERY_KEY[v.mom]] += 1;
      row.total += 1;
      masteryByTier.set(v.tier, row);
      if (v.mom > 0) {
        masteryTotal[
          MASTERY_KEY[v.mom] as "class3" | "class2" | "class1" | "ace"
        ] += 1;
      }
    }
  }

  return {
    garage,
    marks: {
      total: marksTotal,
      byTier: [...marksByTier.values()].sort((a, b) => b.tier - a.tier),
      known,
    },
    mastery: {
      total: masteryTotal,
      byTier: [...masteryByTier.values()].sort((a, b) => b.tier - a.tier),
    },
    reach: buildReach(vehicles, tanks, recentTanks, thresholds),
  };
}

function buildReach(
  vehicles: PlayerTankRow[],
  tanks: TankStats[],
  recentTanks: TankStats[] | null,
  thresholds: Map<number, MarkThresholds>,
): MarkReachEntry[] {
  const lifetime = new Map(tanks.map((t) => [t.tank_id, t]));
  const recent = new Map((recentTanks ?? []).map((t) => [t.tank_id, t]));
  const entries: MarkReachEntry[] = [];

  for (const v of vehicles) {
    // Only vehicles whose marks we know and that still have a mark to earn,
    // and that the encyclopedia knows (the row draws an icon and a class).
    if (v.tier == null || v.tag == null || v.type == null) continue;
    if (v.moe == null || !Number.isInteger(v.moe) || v.moe < 0 || v.moe >= 3)
      continue;
    if (v.battles < MIN_TANK_BATTLES) continue;

    const bar = thresholds.get(v.tankId);
    // All three bars must be present and ascending. A zero (or a pair the
    // provider published out of order) would make `combined >= bar.mark3` true
    // for any damage at all and send the vehicle to the top of the list.
    if (!bar) continue;
    if (!(bar.mark1 > 0 && bar.mark2 >= bar.mark1 && bar.mark3 >= bar.mark2)) {
      continue;
    }

    // The 30-day window is the closer analogue of what Wargaming scores a mark
    // on, but only once it holds enough battles to be the steadier of the two.
    const windowTank = recent.get(v.tankId);
    const useRecent =
      windowTank != null && windowTank.all.battles >= MIN_WINDOW_BATTLES;
    const source = useRecent ? windowTank : lifetime.get(v.tankId);
    if (!source || source.all.battles <= 0) continue;

    const combined = combinedDamage(source) / source.all.battles;
    const playingAt =
      combined >= bar.mark3
        ? 3
        : combined >= bar.mark2
          ? 2
          : combined >= bar.mark1
            ? 1
            : 0;
    // Performing at or below the marks already on the gun is the normal case
    // and says nothing: the list is the vehicles where the two disagree.
    if (playingAt <= v.moe) continue;

    const next = v.moe + 1;
    const nextBar = next === 1 ? bar.mark1 : next === 2 ? bar.mark2 : bar.mark3;
    entries.push({
      tankId: v.tankId,
      slug: v.slug,
      name: v.name,
      tier: v.tier,
      tag: v.tag,
      type: v.type,
      isPremium: v.isPremium,
      marks: v.moe,
      playingAt,
      threshold:
        playingAt === 3 ? bar.mark3 : playingAt === 2 ? bar.mark2 : bar.mark1,
      combined,
      ratio: nextBar > 0 ? combined / nextBar : 1,
      battles: source.all.battles,
      window: useRecent ? MarkWindow.Recent : MarkWindow.Lifetime,
    });
  }

  // Widest gap first (a two-mark shortfall outranks a one-mark one), then by
  // how far past the bar the average sits, so the surest conversions lead.
  return entries
    .sort(
      (a, b) =>
        b.playingAt - b.marks - (a.playingAt - a.marks) || b.ratio - a.ratio,
    )
    .slice(0, REACH_LIMIT);
}
