"use client";

import { cn } from "@/lib/utils";

/**
 * The ring the game draws around a vehicle for the hit points it has left.
 *
 * An arc rather than a bar, because the mark it rings is already a glyph on a
 * crowded map and a bar beside it would be one more thing to disentangle. It
 * runs clockwise from the top, like the game's, and it takes the SIDE's own
 * colour, so only the arc's length says how much is left.
 *
 * It was coloured by the share at first, green above 60% and red below 30%,
 * which read as the opposite of what it meant: those two are the side
 * colours themselves (`emerald-400` and `red-400`), so a healthy enemy drew
 * an ally-green ring and a wounded ally drew an enemy-red one. Colour here
 * is spoken for, and length was free.
 */
export function HealthRing({
  share,
  size,
  className,
}: {
  share: number;
  size: number;
  /** The side's colour class, which the stroke reads as `currentColor`. */
  className?: string;
}) {
  // Thick enough to read at a glance on a busy map, and proportional like
  // everything else here so it holds up on a phone's smaller one.
  const stroke = Math.max(2, Math.round(size * 0.17));
  // Whole pixels, and an even difference from the glyph's box, so the offset
  // below is an integer: centring by `left: 50%` and a half translate lands on
  // a fraction of a pixel that the browser rounds, which drew the ring one
  // pixel high on every vehicle.
  const box = size + 2 * ringOverflow(size);
  // The radius is to the stroke's CENTRE, so half of it has to come off or a
  // thicker ring grows outwards and clips against the viewBox.
  const r = (box - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      aria-hidden
      className={cn("pointer-events-none absolute", className)}
      // Exact arithmetic against the parent, which is the glyph's own square:
      // the overhang is the same whole number of pixels on all four sides.
      style={{ left: (size - box) / 2, top: (size - box) / 2 }}
    >
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={stroke}
      />
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeDasharray={`${circumference * share} ${circumference}`}
        transform={`rotate(-90 ${box / 2} ${box / 2})`}
      />
    </svg>
  );
}

/** How far the ring reaches past the glyph's box on each side, in pixels:
 * what anything placed beside a vehicle has to clear. */
export function ringOverflow(size: number): number {
  return Math.round(size * 0.28);
}
