"use client";

import { StrongholdPeriod } from "@unicum.gg/shared";
import { StatsPeriodSelect } from "@/components/stats-period-select";
import { useStatWindows } from "@/hooks/use-stat-windows";
import { useTranslation } from "@/hooks/use-translation";
import { useStatWindowLabel } from "./stat-window-label";

const SLOT_OF: Partial<Record<StrongholdPeriod, 0 | 1 | 2>> = {
  [StrongholdPeriod.Day]: 0,
  [StrongholdPeriod.Week]: 1,
  [StrongholdPeriod.Month]: 2,
};

/**
 * The phone's column picker for the profile's stats table, naming each column
 * by the window the reader set on it rather than by the shared 24h/7d/30d.
 */
export function PlayerStatsPeriodSelect() {
  const { t } = useTranslation("components/players/detail/overview/stats-table");
  const [windows] = useStatWindows();
  const windowLabel = useStatWindowLabel();
  return (
    <StatsPeriodSelect
      label={(p) => {
        const slot = SLOT_OF[p];
        return slot === undefined ? t("periods.total") : windowLabel(windows[slot]);
      }}
    />
  );
}
