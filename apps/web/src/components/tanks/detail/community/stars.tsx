import { MAX_STARS, RATING_COLOR_HEX, starRatingColor } from "@unicum.gg/shared";
import { cn } from "@/lib/utils";

/**
 * A five-star score, drawn to the tenth.
 *
 * Two stacked rows of the same five glyphs, the filled one clipped to the
 * score's share of the width. Rounding to whole or half stars is the usual
 * shortcut and it lies at exactly the place people look: 4.29 and 4.49 both
 * become four and a half, and the whole point of a community average is that
 * those two are different verdicts.
 *
 * Server-rendered, no client bundle: this appears on every tank page and in
 * every row of the board.
 */

/** One star, as a path rather than a glyph: the text star renders at a
 * different weight in every font stack the site can land in, and half of them
 * have no outlined variant at all. */
function Star({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.31l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94z" />
    </svg>
  );
}

function StarRow({
  size,
  className,
  style,
}: {
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("flex", className)} style={style}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Star key={i} size={size} />
      ))}
    </div>
  );
}

/**
 * How the stars are painted.
 *
 * Two cases, and they are not a style preference. On the page background the
 * fill carries the score, so it is painted on the site's rating ladder and a
 * 2.1 reads differently from a 4.6 before the number does. Inside a table's
 * rating cell the block already carries the score, and a coloured glyph on a
 * coloured ground is unreadable: there the stars inherit the cell's white text,
 * the way the performance cards already mute their label to `text-white/75` on
 * a coloured card.
 */
export enum StarTone {
  Rating = "rating",
  Inherit = "inherit",
}

export function Stars({
  value,
  size = 16,
  className,
  tone = StarTone.Rating,
}: {
  value: number | null;
  size?: number;
  className?: string;
  tone?: StarTone;
}) {
  const filled = value == null ? 0 : Math.max(0, Math.min(MAX_STARS, value));
  const inherit = tone === StarTone.Inherit;
  const color =
    !inherit && value != null
      ? RATING_COLOR_HEX[starRatingColor(value)]
      : undefined;

  return (
    <div
      className={cn("relative inline-flex", className)}
      role="img"
      aria-label={
        value == null ? "Not rated" : `${value.toFixed(2)} out of ${MAX_STARS}`
      }
    >
      <StarRow
        size={size}
        className={inherit ? "text-white/25" : "text-fd-border"}
      />
      {/* Clipped rather than drawn per star: the overlay is the same five
        glyphs, cut at the score's share of the row, so a partial star is a
        partial star and not a rounded one. */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${(filled / MAX_STARS) * 100}%` }}
      >
        <StarRow
          size={size}
          className={color ? undefined : inherit ? undefined : "text-fd-primary"}
          style={color ? { color } : undefined}
        />
      </div>
    </div>
  );
}

/** The score as a number, painted on the same ladder as the stars beside it. */
export function StarValue({
  value,
  className,
  /** Two decimals is what a community average is worth reading at: it is the
   * difference between a tank people like and one they love. */
  digits = 2,
}: {
  value: number | null;
  className?: string;
  digits?: number;
}) {
  if (value == null) {
    return (
      <span className={cn("text-fd-muted-foreground", className)}>&mdash;</span>
    );
  }
  return (
    <span
      className={cn("font-semibold tabular-nums", className)}
      style={{ color: RATING_COLOR_HEX[starRatingColor(value)] }}
    >
      {value.toFixed(digits)}
    </span>
  );
}
