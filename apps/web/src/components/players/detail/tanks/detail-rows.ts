import { numberFormat } from "@/lib/format";
import {
  RATING_COLOR_HEX,
  RatingColor,
  RatingMetric,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
  type PlayerTankDetail,
} from "@unicum.gg/shared";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const RATIO_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PCT_FORMAT = {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

export type DetailRow = {
  label: string;
  value: string;
  /** Colour for the value, currently the rating tier of a WN row. */
  color?: string;
  /** Set on a rating line. All three are rendered and the site's
   * `html[data-rating-metric]` rule hides the two the reader did not pick, so
   * one cached page serves every metric. */
  metric?: RatingMetric;
  /** A breakdown of the line above it, indented and dimmed like the tank
   * page's own characteristics. */
  sub?: boolean;
};

/** A row, or nothing at all when the counter behind it was never stored. Absent
 * rather than dashed: a block of dashes reads like a broken page, where a
 * shorter block just reads like the game's own, which hides what it has no
 * number for either. */
function row(
  label: string,
  value: string | null,
  sub = false,
  color?: string,
  metric?: RatingMetric,
): DetailRow[] {
  return value === null ? [] : [{ label, value, sub, color, metric }];
}

/** A percentage in the colour of the tier it falls in. Same rule as a rating
 * line, and the same reason the darkest tier keeps the inherited colour. */
function coloredPct(
  value: number | null,
  tier: (v: number) => RatingColor,
): string | undefined {
  if (value === null) return undefined;
  const color = tier(value);
  return color === RatingColor.VeryBad ? undefined : RATING_COLOR_HEX[color];
}

/**
 * A rating line: the number in the colour of the tier it falls in.
 *
 * The hex rather than `RATING_COLOR_CLASS`, which paints a background and is
 * built for table cells. On a plain line the colour belongs to the text, and
 * the darkest tier is `#000000`, invisible on a dark page, so it keeps the
 * inherited colour instead.
 */
function ratingRow(
  metric: RatingMetric,
  value: number | null,
  tier: (v: number) => RatingColor, locale: string,
): DetailRow[] {
  if (value === null) return [];
  const color = tier(value);
  return row(
    metric.toUpperCase(),
    numberFormat(locale, INT_FORMAT).format(value),
    false,
    color === RatingColor.VeryBad ? undefined : RATING_COLOR_HEX[color],
    metric,
  );
}

const pct = (v: number | null, locale: string) => (v === null ? null : numberFormat(locale, PCT_FORMAT).format(v));
const ratio = (v: number | null, locale: string) => (v === null ? null : numberFormat(locale, RATIO_FORMAT).format(v));
const int = (v: number | null, locale: string) => (v === null ? null : numberFormat(locale, INT_FORMAT).format(v));

/**
 * The "General Parameters" block, in the game's order.
 *
 * Stuns sit at the end and only appear on a vehicle that lands them, which is
 * the game's own behaviour: every tank reports zero, and a column of zeroes on
 * a heavy says nothing about it.
 */
export function generalRows(d: PlayerTankDetail, locale: string): DetailRow[] {
  return [
    ...row("Battles", int(d.battles, locale)),
    ...row("Victories", pct(d.winrate, locale), false, coloredPct(d.winrate, winrateColor)),
    ...row("Battles survived", pct(d.survivalRate, locale)),
    ...row("Hits", pct(d.hitRate, locale)),
    ...row("Damage ratio", ratio(d.damageRatio, locale)),
    ...row("Destruction ratio", ratio(d.destructionRatio, locale)),
    ...row("Armor-use efficiency", ratio(d.armorUseEfficiency, locale)),
    ...(d.stuns ? row("Number of stuns", int(d.stuns, locale)) : []),
  ];
}

/**
 * The "Record Score" block: the best single battle on this vehicle.
 *
 * Two lines where the game shows three. Its maximum damage has no per-tank
 * source in Wargaming's API: the field exists only inside the battle-mode
 * blocks, and those answer 0 for every tank of every account tried.
 */
export function recordRows(d: PlayerTankDetail, locale: string): DetailRow[] {
  return [
    ...row("Maximum experience", int(d.maxXp, locale)),
    ...row("Maximum destroyed", int(d.maxFrags, locale)),
  ];
}

/** The "Average Score per Battle" block, in the game's order. */
export function averageRows(d: PlayerTankDetail, locale: string): DetailRow[] {
  return [
    // The rating first: it is the one line that answers "was this any good",
    // and the rest of the block is what it was computed from.
    ...ratingRow(RatingMetric.Wn7, d.wn7, wn7Color, locale),
    ...ratingRow(RatingMetric.Wn8, d.wn8, wn8Color, locale),
    ...ratingRow(RatingMetric.Wnx, d.wnx, wnxColor, locale),
    ...row("Experience", int(d.avgXp, locale)),
    ...row("Damage caused", int(d.avgDamage, locale)),
    ...row("Damage received", int(d.avgDamageReceived, locale)),
    ...row("Damage blocked", int(d.avgBlocked, locale)),
    // Only on a vehicle that lands stuns, like the general block above: every
    // other tank reports a flat zero, which says nothing about it.
    ...(d.avgStuns ? row("Number of stuns", ratio(d.avgStuns, locale)) : []),
    ...row("Damage assisted", int(d.avgAssist, locale)),
    ...row("by spotting", int(d.avgAssistRadio, locale), true),
    ...row("by tracking", int(d.avgAssistTrack, locale), true),
    ...(d.avgAssistStun ? row("by stunning", int(d.avgAssistStun, locale), true) : []),
    ...row("Enemies spotted", ratio(d.avgSpotted, locale)),
    ...row("Enemies destroyed", ratio(d.avgFrags, locale)),
    ...row("Base capture", ratio(d.avgCapture, locale)),
    ...row("Base defense", ratio(d.avgDefense, locale)),
  ];
}
