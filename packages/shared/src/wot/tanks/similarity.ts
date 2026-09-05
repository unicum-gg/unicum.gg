import type { TankSpec } from "../../db/schema/tank-specs";
import {
  SHELL_STATS,
  TankAxis,
  TANK_AXES,
  TRACKED_SPEC_FIELDS,
} from "../tank-spec-fields";
import { normalizeSpec, type SpecRanges } from "./spec-ranges";

/**
 * How alike two vehicles are, as the distance between their profiles.
 *
 * A profile is not a vehicle's values, it is where each of those values sits
 * among its peers: 0 is the bottom of the tier, 1 the top. That is deliberate,
 * and it is the whole idea. Compared on raw numbers, every tier X looks alike
 * (they all have a lot of hit points) and every tier VI looks alike, while a
 * tier VI and a tier X that play identically look nothing like each other.
 * Compared on position, "a lot of camouflage, no armour, an accurate gun" is
 * the same sentence about a vehicle whatever tier it is fought at, which is
 * what a player means by two tanks playing the same way.
 *
 * The pure half: no database, no catalogue, no region. Core assembles the
 * values and the ranges, this decides what a profile is and how far apart two
 * of them are.
 */

/** A measured field: where it reads from, and which axis it speaks to.
 *
 * The key is a plain string because the two name spaces it draws from live on
 * either side of the package boundary: `tank_specs` columns are typed here,
 * while the server averages are core's `TankServerStats`, which shared cannot
 * see. The spec-side lists below are typed against `TankSpec` so a renamed
 * column is a compile error there; the playstyle list is checked by the
 * endpoint's own schema instead. */
export type ProfileField = { key: string; axis: TankAxis };

/** A spec-side field, tied to a real `tank_specs` column. */
type SpecProfileField = { key: keyof TankSpec & string; axis: TankAxis };

/**
 * The first-shell firepower fields.
 *
 * They are deliberately absent from `TRACKED_SPEC_FIELDS`, whose job is telling
 * a player what an update changed: there, "damage" is ambiguous, because it is
 * whichever shell the client lists first, so changes are tracked per shell
 * instead. Here the ambiguity does not matter and the omission would: alpha and
 * penetration are most of what separates two guns, and a comparison that left
 * them out would call a 390-alpha heavy and a 240-alpha heavy the same tank.
 *
 * Read off `SHELL_STATS` rather than listed again. Those `stat` names are the
 * `tank_specs` column names, so a sixth per-shell statistic is measured here
 * the day it is tracked there, which is the whole reason `PROFILE_FIELDS` is
 * derived in the first place.
 */
const FIRST_SHELL_FIELDS: SpecProfileField[] = SHELL_STATS.map((stat) => ({
  key: stat.stat,
  axis: TankAxis.Firepower,
}));

/**
 * How a tank is actually played, from the server averages (`tank_stats`).
 *
 * This is the axis a datasheet cannot supply. Two vehicles can be built
 * differently and still be played the same way, and the numbers a whole server
 * puts up on them are the only evidence of it.
 *
 * Winrate, WN8 and the mark counts are left out on purpose: they measure how
 * *strong* a tank is, not how it is played, and a strong and a weak tank can be
 * played identically. Battle counts are left out for the same reason in
 * reverse, they measure popularity. What stays describes what the player
 * spends the battle doing: dealing damage, spotting, assisting, bouncing, and
 * whether they are alive at the end.
 */
const PLAYSTYLE_FIELDS: ProfileField[] = [
  { key: "avg_damage", axis: TankAxis.Playstyle },
  { key: "avg_spots", axis: TankAxis.Playstyle },
  { key: "avg_assist", axis: TankAxis.Playstyle },
  { key: "avg_blocked", axis: TankAxis.Playstyle },
  { key: "survival", axis: TankAxis.Playstyle },
  { key: "kdr", axis: TankAxis.Playstyle },
  { key: "hit_pct", axis: TankAxis.Playstyle },
  { key: "pen_pct", axis: TankAxis.Playstyle },
];

/**
 * Every field a profile is built from, derived from the tracked characteristics
 * rather than listed again, so a characteristic added to the catalogue is
 * compared without anyone remembering to add it here.
 */
export const PROFILE_FIELDS: ProfileField[] = [
  ...TRACKED_SPEC_FIELDS.map((f) => ({ key: f.key, axis: f.axis })),
  ...FIRST_SHELL_FIELDS,
  ...PLAYSTYLE_FIELDS,
];

/** Just the keys, for callers that have to narrow a wider object down to what a
 * profile actually reads (measuring the spread of a value nothing looks up is
 * work and cache weight spent on nothing). */
export const PROFILE_FIELD_KEYS: ReadonlySet<string> = new Set(
  PROFILE_FIELDS.map((f) => f.key),
);

/**
 * How many matches are worked out and kept for a vehicle.
 *
 * One number, read by the core that produces the list and by the endpoint that
 * documents how many a caller may ask for. Two constants that have to agree is
 * how an endpoint ends up advertising a ceiling it silently truncates below.
 */
export const SIMILAR_RESULTS_MAX = 12;

/** The measured values a profile is built from: a tank's specifications and its
 * server averages, flattened into one object. The two name spaces do not
 * collide (specs are camelCase, server averages snake_case). */
export type ProfileSource = Partial<TankSpec> & Record<string, unknown>;

/** A vehicle's standing on every field that could be measured, 0 to 1. Fields
 * the vehicle has no value for (a casemate TD's turret armour) are absent
 * rather than zero: absent means "not applicable", zero would mean "the worst
 * in its tier", and those are different tanks. */
export type TankProfile = Record<string, number>;

/**
 * Place a vehicle's values among its peers.
 *
 * `ranges` decides who the peers are. Measured over one tier, the profile says
 * where the tank stands among the tanks it is fought alongside, which is the
 * reading that makes a tier VI and a tier X comparable at all.
 */
export function buildProfile(
  source: ProfileSource | null,
  ranges: SpecRanges,
): TankProfile {
  const profile: TankProfile = {};
  if (!source) return profile;
  for (const field of PROFILE_FIELDS) {
    const raw = source[field.key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const range = ranges[field.key];
    if (!range) continue;
    profile[field.key] = normalizeSpec(raw, range);
  }
  return profile;
}

/**
 * A fingerprint of what a vehicle *is*, in the game's own numbers.
 *
 * Specifications only, raw values, no server averages: two vehicles that share
 * every characteristic are the same machine wearing two names, whatever their
 * ids, prices or nations say. The game is full of them, a tank reissued for an
 * event, a mode, or a cybercafe, and a comparison that does not notice fills
 * its answers with a vehicle the reader is already looking at.
 *
 * Sameness is decided on the values, never on the name or the tag. Tags do
 * carry the relationship (`R45_IS-7_IGR` is a reissue of `R45_IS-7`), but the
 * same suffix rule also links vehicles that are genuinely different tanks (`T32`
 * and `T32M` are two tiers apart), so reading it would quietly delete real
 * answers. Identical numbers cannot lie in that direction.
 *
 * Null when nothing was measurable: a vehicle we know no characteristic of is
 * not "the same" as another one we know nothing about either.
 */
export function specFingerprint(source: ProfileSource | null): string | null {
  if (!source) return null;
  const parts: string[] = [];
  for (const field of PROFILE_FIELDS) {
    if (field.axis === TankAxis.Playstyle) continue;
    const raw = source[field.key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    parts.push(`${field.key}=${raw}`);
  }
  return parts.length > 0 ? parts.join("|") : null;
}

/** How far apart two vehicles are on one axis, and how much was measured to say
 * so. `gap` is 0 when they stand in the same place on every field of the axis,
 * 1 when one is at the top of the tier and the other at the bottom on all of
 * them. */
export type AxisGap = { axis: TankAxis; gap: number; fields: number };

/**
 * An axis measured on a single field is a coin toss, not a reading: one tank
 * missing a value on a two-field axis would leave the whole aspect resting on
 * the other one. Below this, the axis is dropped instead of reported thinly.
 */
const MIN_FIELDS_PER_AXIS = 2;

/**
 * Fewer axes than this and there is nothing worth calling a similarity: a
 * vehicle we know only the mobility of could be paired with anything.
 */
const MIN_AXES = 3;

/** How the two vehicles stand on each axis that could be measured, in the axis
 * display order. */
export function axisGaps(a: TankProfile, b: TankProfile): AxisGap[] {
  const sums = new Map<TankAxis, { sum: number; count: number }>();
  for (const field of PROFILE_FIELDS) {
    const va = a[field.key];
    const vb = b[field.key];
    if (va === undefined || vb === undefined) continue;
    const entry = sums.get(field.axis) ?? { sum: 0, count: 0 };
    entry.sum += Math.abs(va - vb);
    entry.count += 1;
    sums.set(field.axis, entry);
  }
  const gaps: AxisGap[] = [];
  for (const axis of TANK_AXES) {
    const entry = sums.get(axis);
    if (!entry || entry.count < MIN_FIELDS_PER_AXIS) continue;
    gaps.push({ axis, gap: entry.sum / entry.count, fields: entry.count });
  }
  return gaps;
}

/** How alike two vehicles are, 0 to 100, with the axis readings the number is
 * made of. Null when too little of either vehicle could be measured. */
export type Similarity = { score: number; gaps: AxisGap[] };

/**
 * The distance between two profiles, as a score out of 100.
 *
 * Every axis weighs the same, whatever its number of fields. Weighting by field
 * count would hand the verdict to firepower, which has three times the columns
 * of concealment without being three times the tank. It also means the score
 * cannot be gamed by the catalogue growing a fourth dispersion column.
 *
 * The number is left honest rather than stretched: real pairs land in the 80s
 * and 90s because two tanks of a tier genuinely do share most of their
 * standing, and pulling that apart to fill the scale would be inventing
 * precision the measurement does not have.
 */
export function similarity(a: TankProfile, b: TankProfile): Similarity | null {
  const gaps = axisGaps(a, b);
  if (gaps.length < MIN_AXES) return null;
  const mean = gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length;
  return { score: Math.round((1 - mean) * 100), gaps };
}

/**
 * The typical gap on each axis across a set of comparisons.
 *
 * The reference point that makes a single pair's gaps mean something. Averaged
 * over every candidate a vehicle was measured against, so it says what "close"
 * is *for this vehicle*, not in the abstract.
 */
export function axisBaseline(all: AxisGap[][]): Map<TankAxis, number> {
  const sums = new Map<TankAxis, { sum: number; count: number }>();
  for (const gaps of all) {
    for (const g of gaps) {
      const entry = sums.get(g.axis) ?? { sum: 0, count: 0 };
      entry.sum += g.gap;
      entry.count += 1;
      sums.set(g.axis, entry);
    }
  }
  const out = new Map<TankAxis, number>();
  for (const [axis, entry] of sums) out.set(axis, entry.sum / entry.count);
  return out;
}

/**
 * What actually distinguishes this pairing, nearest first.
 *
 * Read against the baseline rather than in absolute terms, and that is the
 * difference between a useful sentence and a true but empty one. Ranked on the
 * raw gaps, a heavy tank's answers all come back "closest on concealment": every
 * heavy is equally bad at hiding, so the axis where nothing separates them is
 * the one that scores best, on all six results at once. Measured against how far
 * apart this vehicle is from its *other* candidates on the same axis, the axis
 * that surfaces is the one this particular pairing is unusually close on, which
 * is the reason a reader was looking for.
 *
 * The score is deliberately not adjusted the same way: it answers "how alike are
 * these two", which the plain gaps answer correctly, and it has to stay
 * comparable between vehicles that were measured against different fields.
 */
export function distinguishingAxes(
  gaps: AxisGap[],
  baseline: Map<TankAxis, number>,
): AxisGap[] {
  return [...gaps].sort(
    (x, y) =>
      x.gap - (baseline.get(x.axis) ?? 0) - (y.gap - (baseline.get(y.axis) ?? 0)),
  );
}

/** The axes a pairing is closest on, nearest first. What a reader is told when
 * asked why these two go together. */
export function closestAxes(ranked: AxisGap[], limit: number): TankAxis[] {
  return ranked.slice(0, limit).map((g) => g.axis);
}

/** The axis a pairing is furthest apart on, or null when nothing could be
 * measured. What keeps it honest: the one thing that is not alike. */
export function furthestAxis(ranked: AxisGap[]): TankAxis | null {
  return ranked.length > 0 ? ranked[ranked.length - 1].axis : null;
}
