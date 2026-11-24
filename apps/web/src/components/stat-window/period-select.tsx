"use client";

import { StrongholdPeriod } from "@unicum.gg/shared";
import { StatsPeriodSelect } from "@/components/stats-period-select";
import { StatWindowScope, useStatWindows } from "@/hooks/use-stat-windows";
import { useStatWindowLabel } from "./label";

const SLOT_OF: Partial<Record<StrongholdPeriod, 0 | 1 | 2>> = {
  [StrongholdPeriod.Day]: 0,
  [StrongholdPeriod.Week]: 1,
  [StrongholdPeriod.Month]: 2,
};

/**
 * The phone's column picker for a table whose period columns the reader
 * sets, naming each column by its window rather than by the shared
 * 24h/7d/30d.
 */
export function StatWindowPeriodSelect({
  scope = StatWindowScope.Player,
}: {
  scope?: StatWindowScope;
}) {
  const [windows] = useStatWindows(scope);
  const windowLabel = useStatWindowLabel();
  return (
    <StatsPeriodSelect
      label={(p) => {
        const slot = SLOT_OF[p];
        return slot === undefined ? null : windowLabel(windows[slot]);
      }}
    />
  );
}
