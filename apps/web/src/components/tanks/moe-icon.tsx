// The in-house Marks-of-Excellence chevrons (1-3 bars), shared by the tank
// Marks tab and the player vehicles table. Colours are a prestige ramp by mark
// level: bronze (1) -> silver (2) -> gold (3).
const MARK_BARS = [
  "M3.765 0h2.824L2.823 12H0L3.765 0z",
  "m4.706 0h2.824L7.529 12H4.706L8.471 0z",
  "m4.706 0H16l-3.765 12H9.412l3.764-12h.001z",
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
}: {
  bars: 1 | 2 | 3;
  color: string;
}) {
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
