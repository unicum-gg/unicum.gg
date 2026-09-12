"use client";

import { useTranslation } from "@/hooks/use-translation";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  type RowDef,
  StrongholdStatsTable,
  type StrongholdPeriods,
  type WinrateColorFn,
} from "@/components/players/detail/overview/stronghold-stats-table";
import { StatsPeriodSelect } from "@/components/stats-period-select";
import { styles } from "@/lib/styles";
import type { StrongholdStats } from "@unicum.gg/shared";

export type StrongholdData = {
  current: StrongholdStats | null;
  periods: StrongholdPeriods;
};

/** The Overview section under any of the eight stronghold-style modes: a single
 * stronghold stats table, or a "no data yet" fallback. `trailingRows` appends
 * mode-specific rows (the Steel Hunter HR) after the shared set. */
export function StrongholdTab({
  nickname,
  label,
  data,
  trailingRows,
  winrateColorFn,
}: {
  nickname: string;
  label: string;
  data: StrongholdData;
  trailingRows?: RowDef[];
  winrateColorFn?: WinrateColorFn;
}) {
  const { t } = useTranslation("components/players/detail/overview/stronghold");
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {t("title", { nickname, label })}
            {/* Only with a table under it: over the "no data yet" message it
                offered a choice that changed nothing. */}
            {data.current !== null && <StatsPeriodSelect />}
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {data.current !== null ? (
            <StrongholdStatsTable
              current={data.current}
              periods={data.periods}
              trailingRows={trailingRows}
              winrateColorFn={winrateColorFn}
            />
          ) : (
            <div className={`p-4 ${styles.mutedDescription}`}>
              {t("no-data-yet-check-back", { label })}</div>
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
