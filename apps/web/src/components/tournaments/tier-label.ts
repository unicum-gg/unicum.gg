import { toRoman } from "roman-numerals";

/**
 * A tier band, in the two readings the feature actually uses.
 *
 * They are not the same string, which is why six near-copies grew: a meta strip
 * has to say what the number IS ("Tier X"), while a table column already says it
 * in its header and wants the numeral alone. Both live here so a change lands
 * once, and so the two stop disagreeing about what an absent band looks like.
 */

/** For a meta strip: "Tier X", or "Tier VI-X" when it spans. Null when the
 * tournament declares no band, which is a real state. */
export function tierLabel(from: number | null, to: number | null): string | null {
  const band = tierBand(from, to);
  return band === null ? null : `Tier ${band}`;
}

/** For a table cell: the numeral alone, or null when there is no band. Callers
 * render their own placeholder, since a dash is a table's convention and not a
 * property of the band. */
export function tierBand(from: number | null, to: number | null): string | null {
  if (from === null && to === null) return null;
  if (from === null || to === null) return toRoman(from ?? to!);
  return from === to ? toRoman(from) : `${toRoman(from)}-${toRoman(to)}`;
}
