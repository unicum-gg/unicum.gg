import romanNumerals from "roman-numerals";
import {
  displaySpecValue,
  resolveTrackedField,
  SpecDirection,
  type VehicleMeta,
} from "@unicum.gg/shared";
import { clamp } from "@unicum.gg/core/discord/announce";

/**
 * One vehicle's balance changes as Discord shows them: a `diff` code block.
 *
 * Discord colours a `diff` block's `+` lines green and its `-` lines red, on
 * mobile too, and it is the only colour an embed can carry. So the sign of a
 * line is the verdict on it, read from the field's own direction
 * (`SpecDirection`), never from whether the number went up: a reload that drops
 * from 8 to 7.5 seconds is a `+`. A field with no direction (a caliber, a clip
 * size) is a plain line, since it is neither.
 */

// `roman-numerals` is CommonJS: a named ESM import throws at boot.
const { toRoman } = romanNumerals as { toRoman: (n: number) => string };

export type SpecChangeRow = {
  field: string;
  previous: number | null;
  next: number | null;
};

export enum Verdict {
  Buff = "buff",
  Nerf = "nerf",
  Mixed = "mixed",
  /** Only fields with no direction moved. */
  Neutral = "neutral",
}

export const VERDICT_EMOJI: Record<Verdict, string> = {
  [Verdict.Buff]: "🟢",
  [Verdict.Nerf]: "🔴",
  [Verdict.Mixed]: "🟡",
  [Verdict.Neutral]: "⚪",
};

const CLASS_SHORT: Record<string, string> = {
  lightTank: "LT",
  mediumTank: "MT",
  heavyTank: "HT",
  "AT-SPG": "TD",
  SPG: "SPG",
};

/** The nations whose name is not just the token capitalised. */
const NATION_NAME: Record<string, string> = {
  usa: "USA",
  ussr: "USSR",
  uk: "UK",
  czech: "Czechoslovakia",
  intunion: "International",
};

/** "X LT · USA". */
export function vehicleLine(meta: VehicleMeta): string {
  const nation =
    NATION_NAME[meta.nation] ??
    meta.nation.charAt(0).toUpperCase() + meta.nation.slice(1);
  return `${toRoman(meta.tier)} ${CLASS_SHORT[meta.type] ?? meta.type} · ${nation}`;
}

type Line = { sign: "+" | "-" | " "; label: string; from: string; to: string };

function formatValue(value: number | null, digits: number | undefined): string {
  if (value === null) return "none";
  const d = digits ?? 0;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** A change as a signed line, or null for a field with no descriptor (the tier
 * XI ability parameters), which the caller counts instead of printing raw. */
function toLine(change: SpecChangeRow): Line | null {
  const field = resolveTrackedField(change.field);
  if (!field) return null;
  const from = displaySpecValue(field, change.previous);
  const to = displaySpecValue(field, change.next);
  let sign: Line["sign"] = " ";
  if (from !== null && to !== null && from !== to) {
    const better =
      field.direction === SpecDirection.HigherBetter
        ? to > from
        : field.direction === SpecDirection.LowerBetter
          ? to < from
          : null;
    if (better !== null) sign = better ? "+" : "-";
  }
  const unit = field.unit ? ` ${field.unit}` : "";
  return {
    sign,
    label: field.label,
    from: formatValue(from, field.digits),
    to: `${formatValue(to, field.digits)}${unit}`,
  };
}

export type TankDiff = {
  verdict: Verdict;
  lines: Line[];
  /** Changes with no descriptor, reported as a count. */
  unlabelled: number;
};

export function diffTank(changes: SpecChangeRow[]): TankDiff {
  const lines: Line[] = [];
  let unlabelled = 0;
  for (const change of changes) {
    const line = toLine(change);
    if (line) lines.push(line);
    else unlabelled += 1;
  }
  // Buffs first, then nerfs, then the neutral lines: the block reads as a
  // verdict before it reads as a list.
  const order = { "+": 0, "-": 1, " ": 2 };
  lines.sort((a, b) => order[a.sign] - order[b.sign]);
  const buffs = lines.some((l) => l.sign === "+");
  const nerfs = lines.some((l) => l.sign === "-");
  const verdict =
    buffs && nerfs
      ? Verdict.Mixed
      : buffs
        ? Verdict.Buff
        : nerfs
          ? Verdict.Nerf
          : Verdict.Neutral;
  return { verdict, lines, unlabelled };
}

/** Labels longer than this are cut so the arrows stay in one column on a
 * phone, where a code block wraps rather than scrolls. */
const LABEL_WIDTH = 26;

/**
 * The `diff` block, at most `max` lines, the rest counted on a last line of its
 * own. `max` is unbounded for the thread, which carries every change.
 */
export function diffBlock(diff: TankDiff, max = Infinity): string {
  const shown = diff.lines.slice(0, max);
  const width = Math.min(
    LABEL_WIDTH,
    Math.max(...shown.map((l) => l.label.length), 0),
  );
  const from = Math.max(...shown.map((l) => l.from.length), 0);
  const body = shown.map(
    (l) =>
      `${l.sign} ${clamp(l.label, width).padEnd(width)}  ${l.from.padStart(from)} → ${l.to}`,
  );
  const rest = diff.lines.length - shown.length + diff.unlabelled;
  if (rest > 0) {
    body.push(`  +${rest} more ${rest === 1 ? "change" : "changes"}`);
  }
  return ["```diff", ...body, "```"].join("\n");
}
