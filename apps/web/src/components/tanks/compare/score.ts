import { normalizeSpec, type SpecRange, type TankSpec } from "@unicum.gg/shared";
import type { SpecRanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-ranges";
import { GROUPS, type Group, type Row } from "@/components/tanks/detail/specifications/characteristics/rows";

/** The scale category scores are reported on, matching the game's own four-digit
 * figures closely enough to read the same way. */
export const MAX_SCORE = 1000;

/**
 * Which rows of a group a score is built from, derived from the rows themselves
 * rather than a hand-kept list, so a characteristic added to the table is scored
 * without anyone remembering to add it here.
 *
 * Excluded are the sub-headings (no value of their own), the rows with no stored
 * field (`compute` rows restate stored ones: effective speed is top speed and
 * terrain resistance again), the neutral rows (a bigger caliber or a longer
 * maximum range is not "better", so it can't move a score), and the monetary
 * ones (a cheap shell is not firepower).
 */
function scoredRows(group: Group): Row[] {
  return group.rows.filter(
    (r) => !r.header && !r.neutral && !r.currency && !!r.key,
  );
}

/**
 * How far along the catalogue a value sits, 0 to 1, with the row's own sense of
 * "better": a lower reload and a higher DPM both score high.
 *
 * The placement itself is the shared `normalizeSpec` (clamped to the 5th-95th
 * percentile band the endpoint measured, so the handful of extreme vehicles
 * does not stretch the scale until everything else looks identical). All this
 * adds is the direction, which is what separates scoring a vehicle from
 * comparing two: there, position is the whole answer; here, a low reload has to
 * come out high.
 */
function normalize(value: number, range: SpecRange, row: Row) {
  const placed = normalizeSpec(value, range);
  return row.lowerBetter ? 1 - placed : placed;
}

/**
 * A vehicle's standing in one category, as the average position of its
 * characteristics across the whole catalogue.
 *
 * Absolute, not relative to the vehicles on screen: adding or removing a column
 * never moves another column's score, and a tier VIII scores below a tier X the
 * way it should. Returns null when nothing in the group could be measured (the
 * catalogue has no spread on it, or the vehicle has none of its values).
 */
export function categoryScore(
  specs: TankSpec | null,
  group: Group,
  ranges: SpecRanges,
): number | null {
  if (!specs) return null;
  let sum = 0;
  let count = 0;
  for (const row of scoredRows(group)) {
    const range = ranges[row.key as string];
    if (!range) continue;
    // The raw stored value, not the displayed one: `scale` is a positive display
    // factor (camo as a percentage, weight in tons), so it cancels out of the
    // normalisation, and the ranges are measured on the stored values.
    const raw = specs[row.key as keyof TankSpec];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    sum += normalize(raw, range, row);
    count += 1;
  }
  if (count === 0) return null;
  return Math.round((sum / count) * MAX_SCORE);
}

/**
 * One number for the whole vehicle: the average of its category standings.
 *
 * Every category weighs the same, which is the only honest thing to do without
 * deciding for the reader whether firepower matters more than concealment. It is
 * a summary, not a verdict: a scout and a heavy can land on the same score by
 * being good at entirely different things, which is what the categories below it
 * are there to show.
 */
export function overallScore(
  specs: TankSpec | null,
  ranges: SpecRanges,
): number | null {
  const scores = GROUPS.map((g) => categoryScore(specs, g, ranges)).filter(
    (s): s is number => s != null,
  );
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** The columns holding the highest overall score, so the comparison can say
 * which vehicle comes out on top the way the player and clan comparisons mark
 * their best rating. Empty when nothing can be scored, or on a lone column. */
export function bestOverall(scores: (number | null)[]): Set<number> {
  const present = scores
    .map((score, i) => ({ score, i }))
    .filter((e): e is { score: number; i: number } => e.score != null);
  if (present.length < 2) return new Set();
  const best = Math.max(...present.map((e) => e.score));
  return new Set(present.filter((e) => e.score === best).map((e) => e.i));
}
