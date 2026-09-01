/**
 * Filled-cell classes for the mark levels, mirroring `RATING_COLOR_CLASS`.
 *
 * Written as literal `bg-[#...]` strings so Tailwind's scanner sees them at
 * build time, which is the same reason the rating ramp is spelled out rather
 * than derived from `RATING_COLOR_HEX`. Keep the hexes in step with
 * `MOE_COLORS` in `components/tanks/moe-icon`.
 *
 * The text colour follows the fill: bronze is dark enough for white, silver and
 * gold are not.
 */
export const MARK_CELL_CLASS: Record<1 | 2 | 3, string> = {
  1: "bg-[#CD7F32]! text-white",
  2: "bg-[#C4C9D1]! text-black",
  3: "bg-[#F0B429]! text-black",
};
