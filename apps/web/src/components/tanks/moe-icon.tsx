// The in-house Marks-of-Excellence chevrons (1-3 bars), shared by the tank
// Marks tab and the player vehicles table. Colours are a prestige ramp by mark
// level: bronze (1) -> silver (2) -> gold (3).
// Each bar in ABSOLUTE coordinates, and that matters more than it looks.
//
// These were written relative: the second and third opened with a lowercase
// `m`, so each one started from wherever the previous one left off. That works
// only while the bars are concatenated from the first, which is what drawing
// "the marks earned" happens to do. Drawing the UNEARNED ones is a second path
// that starts in the middle of the set, and a relative start made it leap back
// toward the origin -- the middle bar came out sliced.
//
// Absolute, each bar stands where it belongs whichever ones are drawn.
const MARK_BARS = [
  "M3.765 0h2.824L2.823 12H0L3.765 0z",
  "M8.471 0h2.824L7.529 12H4.706L8.471 0z",
  "M13.177 0H16l-3.765 12H9.412l3.764-12h.001z",
];
const MARK_WIDTH = { 1: 6.6, 2: 11.3, 3: 16 } as const;

export const MOE_COLORS: Record<1 | 2 | 3, string> = {
  1: "#CD7F32",
  2: "#C4C9D1",
  3: "#F0B429",
};

export function MoEIcon({
  bars,
  color,
  empty = false,
}: {
  /** Zero is only meaningful with `empty`: three places, none of them earned. */
  bars: 0 | 1 | 2 | 3;
  color: string;
  /**
   * Draw all three places, the unearned ones faint.
   *
   * For a COLUMN, where the icon sits beside a figure on every row: sized to
   * its bars, one mark is a third as wide as three and everything after it
   * shifts, so a column of percentages comes out ragged. Three places always
   * occupy the same width, and the faint bars are not padding -- they say how
   * much is left, which is the thing somebody grinding a mark wants to see.
   *
   * Off by default, because a single icon standing on its own should be as
   * wide as what it shows.
   */
  empty?: boolean;
}) {
  if (!empty) {
    if (bars === 0) return null;
    return (
      <svg
        viewBox={`0 0 ${MARK_WIDTH[bars]} 12`}
        className="inline-block h-3.5 w-auto"
        fill={color}
        aria-hidden
      >
        <path fillRule="evenodd" d={MARK_BARS.slice(0, bars).join("")} />
      </svg>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${MARK_WIDTH[3]} 12`}
      className="text-fd-muted-foreground inline-block h-3.5 w-4 shrink-0"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d={MARK_BARS.slice(bars).join("")}
        fill="currentColor"
        opacity={0.2}
      />
      <path fillRule="evenodd" d={MARK_BARS.slice(0, bars).join("")} fill={color} />
    </svg>
  );
}
