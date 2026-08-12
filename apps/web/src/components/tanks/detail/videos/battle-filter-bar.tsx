"use client";

import {
  BATTLE_FORMAT_LABEL,
  BATTLE_RESULT_LABEL,
  BattleFormat,
  BattleResult,
  SPAWN_DIRECTION_LABEL,
  SpawnDirection,
} from "@unicum.gg/shared";
import { cn } from "@/lib/utils";
import type { useBattleFilters } from "./battle-filters";

/** One value, with how many rows it would leave. */
function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
        active
          ? "border-brand bg-brand/10 text-fd-foreground"
          : "border-fd-border text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground",
      )}
    >
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-fd-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * The three axes a list of battles is looked up by.
 *
 * Only values the map actually has are offered, and each carries its count: a
 * filter that would empty the list is not a filter, it is a dead end, and a
 * shot-caller scanning for "the west side in Clan Wars" wants to know there are
 * three of those before clicking.
 *
 * The order is the order the question is asked in: what was being played, then
 * which side of the map, then how it ended.
 */
export function BattleFilterBar({
  filters,
  counts,
  toggle,
  active,
  reset,
}: ReturnType<typeof useBattleFilters>) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {counts.formats.size > 1 && (
        <Group label="Format">
          {Object.values(BattleFormat)
            .filter((f) => counts.formats.has(f))
            .map((f) => (
              <Chip
                key={f}
                label={BATTLE_FORMAT_LABEL[f]}
                count={counts.formats.get(f) ?? 0}
                active={filters.format === f}
                onClick={() => toggle("format", f)}
              />
            ))}
        </Group>
      )}

      {counts.directions.size > 1 && (
        // The side, which on a tactic is the whole point: a plan for the west
        // spawn is not a plan for the east one.
        <Group label="Spawn">
          {Object.values(SpawnDirection)
            .filter((d) => counts.directions.has(d))
            .map((d) => (
              <Chip
                key={d}
                label={SPAWN_DIRECTION_LABEL[d]}
                count={counts.directions.get(d) ?? 0}
                active={filters.direction === d}
                onClick={() => toggle("direction", d)}
              />
            ))}
        </Group>
      )}

      {counts.results.size > 1 && (
        <Group label="Result">
          {Object.values(BattleResult)
            .filter((r) => counts.results.has(r))
            .map((r) => (
              <Chip
                key={r}
                label={BATTLE_RESULT_LABEL[r]}
                count={counts.results.get(r) ?? 0}
                active={filters.result === r}
                onClick={() => toggle("result", r)}
              />
            ))}
        </Group>
      )}

      {active && (
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer text-xs text-fd-muted-foreground underline-offset-2 hover:text-fd-foreground hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
