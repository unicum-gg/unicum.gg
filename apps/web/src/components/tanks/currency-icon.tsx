import { cn } from "@/lib/utils";

export type Currency = "xp" | "credits" | "gold";

// WG's own tankopedia currency glyphs (the `tank-statistic_ico__*` icons):
// XP is a star, credits/gold a double coin-stack. Colored by currency
// (cream XP, silver credits, gold gold) via `text-*`; `fill="currentColor"`.
const COIN_PATHS = [
  "M4.9 1204.7c-2.7 0-4.9-1.2-4.9-2.7v1.8c0 1.5 2.2 2.7 4.9 2.7s4.9-1.2 4.9-2.7v-1.8c0 1.5-2.2 2.7-4.9 2.7z",
  "M4.9 1201.2c-2.7 0-4.9-1.2-4.9-2.7v1.8c0 1.5 2.2 2.7 4.9 2.7s4.9-1.2 4.9-2.7v-1.7c0 1.4-2.2 2.6-4.9 2.6z",
  "M4.9 1197.6c-2.7 0-4.9-1.2-4.9-2.7v1.8c0 1.5 2.2 2.7 4.9 2.7s4.9-1.2 4.9-2.7v-1.7c0 1.4-2.2 2.6-4.9 2.6z",
  "M8.3 1191.2c-.9-.4-2-.7-3.4-.7s-2.7.3-3.6.8c-.8.5-1.3 1.1-1.3 1.8 0 1.5 2.2 2.7 4.9 2.7s4.9-1.2 4.9-2.7c0-.7-.6-1.4-1.5-1.9zm7.8 13.5c-2.7 0-4.9-1.2-4.9-2.7v1.8c0 1.5 2.2 2.7 4.9 2.7s4.9-1.2 4.9-2.7v-1.7c.1 1.4-2.1 2.6-4.9 2.6z",
  "M16.1 1201.2c-2.7 0-4.9-1.2-4.9-2.7v1.8c0 1.5 2.2 2.7 4.9 2.7s4.9-1.2 4.9-2.7v-1.7c.1 1.4-2.1 2.6-4.9 2.6z",
  "M16.1 1199.4c2.7 0 4.9-1.2 4.9-2.7 0-.8-.6-1.5-1.5-2-.9-.4-2-.7-3.4-.7s-2.7.3-3.6.8c-.8.5-1.3 1.1-1.3 1.8 0 1.6 2.2 2.8 4.9 2.8z",
];

export function CurrencyIcon({
  type,
  className,
}: {
  type: Currency;
  className?: string;
}) {
  if (type === "xp") {
    return (
      <svg
        viewBox="0 0 10 10"
        fill="currentColor"
        className={cn("size-3.5 text-[#E9E2BF]", className)}
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M4.998.003l1.296 3.796H10L6.95 6.24l1.139 3.791-3.09-2.378-3.092 2.378L3.036 6.24-.003 3.799h3.685z"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 1190.6 21 16"
      fill="currentColor"
      className={cn(
        "h-3.5 w-auto",
        type === "gold" ? "text-[#F0B429]" : "text-[#C6CBD1]",
        className,
      )}
      aria-hidden
    >
      {COIN_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
