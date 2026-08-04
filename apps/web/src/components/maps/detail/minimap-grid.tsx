import { cn } from "@/lib/utils";

// The in-game minimap grid, aligned to the arena boundingBox (which is exactly
// what our minimap image spans, so it registers 1:1). Standard maps use the
// game's 10x10 A-K / 1-0 lattice; oversized maps (Frontline is 3000m = 3x3
// sectors of 1000m) keep the same ~100m cell size instead, so the grid becomes
// 30x30 and its lines fall on the 1000m sector borders rather than fighting the
// baked 3x3 division. Rows are lettered (game skips "I"), columns numbered.
const GRID_LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ"; // A-Z without "I"
const gridLabel =
  "absolute font-mono text-[9px] font-bold leading-none text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]";

function rowLabel(i: number): string {
  if (i < GRID_LETTERS.length) return GRID_LETTERS[i];
  const j = i - GRID_LETTERS.length;
  return (
    GRID_LETTERS[Math.floor(j / GRID_LETTERS.length)] +
    GRID_LETTERS[j % GRID_LETTERS.length]
  );
}

function colLabel(i: number, count: number): string {
  // The classic 10-wide grid numbers its last column "0" (the game's quirk);
  // wider grids just count up.
  return count === 10 ? String((i + 1) % 10) : String(i + 1);
}

// Cell count for one axis: keep the game's 10 divisions for normal maps, but on
// oversized maps switch to a fixed ~100m cell so the lattice lines up with the
// 1000m sector borders.
export function axisCells(meters: number, maxDim: number): number {
  const cell = maxDim >= 1500 ? 100 : maxDim / 10;
  return Math.max(1, Math.round(meters / cell));
}

export function MinimapGrid({ cols, rows }: { cols: number; rows: number }) {
  const vLines = Array.from({ length: cols - 1 }, (_, i) => ((i + 1) / cols) * 100);
  const hLines = Array.from({ length: rows - 1 }, (_, i) => ((i + 1) / rows) * 100);
  return (
    <div className="pointer-events-none absolute inset-0">
      {vLines.map((p, i) => (
        <div
          key={`v${i}`}
          className="absolute inset-y-0 w-px bg-white/15"
          style={{ left: `${p}%` }}
        />
      ))}
      {hLines.map((p, i) => (
        <div
          key={`h${i}`}
          className="absolute inset-x-0 h-px bg-white/15"
          style={{ top: `${p}%` }}
        />
      ))}
      {Array.from({ length: cols }, (_, i) => (
        <span
          key={`c${i}`}
          className={cn(gridLabel, "top-2 -translate-x-1/2")}
          // When the first column's centre falls within the left row-label gutter
          // (a dense Frontline grid, or any grid on a narrow viewport), "1" stacks
          // on top of "A"; clamp it right by a fixed 20px minimum so the corner
          // never collides. The `%` wins whenever the cell is wide enough.
          style={{ left: `max(${((i + 0.5) / cols) * 100}%, 20px)` }}
        >
          {colLabel(i, cols)}
        </span>
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <span
          key={`r${i}`}
          className={cn(gridLabel, "left-2.5 -translate-y-1/2")}
          style={{ top: `${((i + 0.5) / rows) * 100}%` }}
        >
          {rowLabel(i)}
        </span>
      ))}
    </div>
  );
}
