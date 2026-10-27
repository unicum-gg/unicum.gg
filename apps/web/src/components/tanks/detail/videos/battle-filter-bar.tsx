"use client";

import { useTranslation } from "@/hooks/use-translation";
import {
  BattleFormat,
  BattleResult,
  SpawnDirection,
} from "@unicum.gg/shared";
import { SegmentedControl } from "@/components/segmented-control";
import type { useBattleFilters } from "./battle-filters";

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
  const { t } = useTranslation("components/tanks/detail/videos/battle-filter-bar");
  const { t: tGame } = useTranslation("game/vocabulary");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {counts.formats.size > 1 && (
        <Group label={t("format")}>
          <SegmentedControl
            active={filters.format ?? ""}
            onSelect={(value) => toggle("format", value as BattleFormat)}
            segments={Object.values(BattleFormat)
              .filter((value) => counts.formats.has(value))
              .map((value) => ({
                id: value,
                label: tGame(`battle-formats.${value}`),
                count: counts.formats.get(value) ?? 0,
              }))}
          />
        </Group>
      )}

      {counts.directions.size > 1 && (
        // The side, which on a tactic is the whole point: a plan for the west
        // spawn is not a plan for the east one.
        <Group label={t("spawn")}>
          <SegmentedControl
            active={filters.direction ?? ""}
            onSelect={(value) => toggle("direction", value as SpawnDirection)}
            segments={Object.values(SpawnDirection)
              .filter((value) => counts.directions.has(value))
              .map((value) => ({
                id: value,
                label: tGame(`spawn-directions.${value}`),
                count: counts.directions.get(value) ?? 0,
              }))}
          />
        </Group>
      )}

      {counts.results.size > 1 && (
        <Group label={t("result")}>
          <SegmentedControl
            active={filters.result ?? ""}
            onSelect={(value) => toggle("result", value as BattleResult)}
            segments={Object.values(BattleResult)
              .filter((value) => counts.results.has(value))
              .map((value) => ({
                id: value,
                label: tGame(`battle-results.${value}`),
                count: counts.results.get(value) ?? 0,
              }))}
          />
        </Group>
      )}

      {active && (
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer text-xs text-fd-muted-foreground underline-offset-2 hover:text-fd-foreground hover:underline"
        >
          {t("clear")}</button>
      )}
    </div>
  );
}
