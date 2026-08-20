import type { RatingColor } from "@unicum.gg/shared";
import { winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import type { CompareVehicle } from "@unicum.gg/core/wargaming/wot/tanks/compare-assemble";
import { dec2Fmt, intFmt } from "@/components/compare/cells";

export type PerfRow = {
  label: string;
  /** Direction of "better"; omitted rows are informational (no winner). */
  kind?: "higher" | "lower";
  value: (v: CompareVehicle) => number | null;
  format: (n: number) => string;
  color?: (n: number) => RatingColor;
};

export type PerfGroup = { title: string; rows: PerfRow[] };

const pct1Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// The server-side stats store percentages as 0-100, not as a 0-1 ratio (the
// rating colour helpers take the ratio, hence the /100 where one is used).
const pct = (n: number) => `${dec2Fmt.format(n)}%`;
const pct1 = (n: number) => `${pct1Fmt.format(n)}%`;
const int = (n: number) => intFmt.format(n);
const dec = (n: number) => dec2Fmt.format(n);
const ratio = (n: number) => n / 100;

/**
 * What the servers make of these vehicles, which the game's own comparison
 * cannot tell you: the characteristics say what a tank is capable of, these say
 * what it actually does in the hands of the players tracked on this region.
 */
export const PERFORMANCE_GROUPS: PerfGroup[] = [
  {
    title: "Server averages",
    rows: [
      {
        label: "Winrate",
        kind: "higher",
        value: (v) => v.stats?.winrate ?? null,
        format: pct,
        color: (n) => winrateColor(ratio(n)),
      },
      {
        label: "Average damage",
        kind: "higher",
        value: (v) => v.stats?.avg_damage ?? null,
        format: int,
      },
      {
        label: "Average assist",
        kind: "higher",
        value: (v) => v.stats?.avg_assist ?? null,
        format: int,
      },
      {
        label: "Average spots",
        kind: "higher",
        value: (v) => v.stats?.avg_spots ?? null,
        format: dec,
      },
      {
        label: "Average blocked",
        kind: "higher",
        value: (v) => v.stats?.avg_blocked ?? null,
        format: int,
      },
      {
        label: "Kills per death",
        kind: "higher",
        value: (v) => v.stats?.kdr ?? null,
        format: dec,
      },
      {
        label: "Survival",
        kind: "higher",
        value: (v) => v.stats?.survival ?? null,
        format: pct1,
      },
      {
        label: "Hit ratio",
        kind: "higher",
        value: (v) => v.stats?.hit_pct ?? null,
        format: pct1,
      },
      {
        label: "Penetration ratio",
        kind: "higher",
        value: (v) => v.stats?.pen_pct ?? null,
        format: pct1,
      },
    ],
  },
  {
    title: "Ratings",
    rows: [
      {
        label: "WN7",
        kind: "higher",
        value: (v) => v.stats?.wn7 ?? null,
        format: int,
        color: wn7Color,
      },
      {
        label: "WN8",
        kind: "higher",
        value: (v) => v.stats?.wn8 ?? null,
        format: int,
        color: wn8Color,
      },
      {
        label: "WNX",
        kind: "higher",
        value: (v) => v.stats?.wnx ?? null,
        format: int,
        color: wnxColor,
      },
      {
        label: "Players' own winrate",
        value: (v) => v.stats?.player_wr ?? null,
        format: pct,
        color: (n) => winrateColor(ratio(n)),
      },
      {
        label: "Expected damage (WN8)",
        value: (v) => v.wn8Expected?.expDamage ?? null,
        format: int,
      },
      {
        label: "Expected winrate (WN8)",
        value: (v) => v.wn8Expected?.expWinRate ?? null,
        format: pct,
      },
    ],
  },
  {
    title: "Marks of Excellence",
    rows: [
      {
        label: "1 mark",
        kind: "lower",
        value: (v) => v.moe?.mark1 ?? null,
        format: int,
      },
      {
        label: "2 marks",
        kind: "lower",
        value: (v) => v.moe?.mark2 ?? null,
        format: int,
      },
      {
        label: "3 marks",
        kind: "lower",
        value: (v) => v.moe?.mark3 ?? null,
        format: int,
      },
    ],
  },
  {
    title: "Marks of Mastery",
    rows: [
      {
        label: "3rd class",
        kind: "lower",
        value: (v) => v.mastery?.class3 ?? null,
        format: int,
      },
      {
        label: "2nd class",
        kind: "lower",
        value: (v) => v.mastery?.class2 ?? null,
        format: int,
      },
      {
        label: "1st class",
        kind: "lower",
        value: (v) => v.mastery?.class1 ?? null,
        format: int,
      },
      {
        label: "Ace Tanker",
        kind: "lower",
        value: (v) => v.mastery?.ace ?? null,
        format: int,
      },
    ],
  },
  {
    title: "Coverage",
    rows: [
      {
        label: "Tracked players",
        value: (v) => v.stats?.players ?? null,
        format: int,
      },
      {
        label: "Battles each",
        value: (v) => v.stats?.avg_battles ?? null,
        format: int,
      },
      {
        label: "Battles tracked",
        value: (v) => v.stats?.total_battles ?? null,
        format: int,
      },
    ],
  },
];
