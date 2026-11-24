"use client";

import type { ComponentProps } from "react";
import type { Region } from "@unicum.gg/wargaming";
import type { StatWindowMode, StrongholdStats } from "@unicum.gg/shared";
import {
  StrongholdStatsTable,
  type StrongholdPeriods,
  type StrongholdTableSection,
} from "./stronghold-stats-table";
import { StatWindowHead } from "@/components/stat-window/head";
import { useModeWindowColumns } from "./use-mode-window-columns";

type TableProps = Extract<
  ComponentProps<typeof StrongholdStatsTable>,
  { current: StrongholdStats }
>;

/**
 * A mode tab's stats table with the profile's three period columns: the
 * windows the reader set through any column's pencil, read from the payload
 * where it carries them and from the mode period endpoint otherwise.
 *
 * The sections under the shared rows (Skirmish's tiers) are measured over
 * the payload's three windows only, so a column set to anything else dashes
 * them rather than filing a 30-day figure under a 1000-battle heading.
 */
export function ModeWindowTable({
  region,
  nickname,
  mode,
  periods,
  sections,
  ...rest
}: Omit<TableProps, "periods" | "periodHeads"> & {
  region: Region;
  nickname: string;
  mode: StatWindowMode;
  periods: StrongholdPeriods;
}) {
  const [h24, d7, d30] = useModeWindowColumns(region, nickname, mode, periods);
  const keep = (
    column: { custom: boolean },
    stats: StrongholdStats | null,
  ): StrongholdStats | null => (column.custom ? null : stats);
  const windowedSections: StrongholdTableSection[] | undefined = sections?.map((s) => ({
    ...s,
    periods: {
      h24: keep(h24, s.periods.h24),
      d7: keep(d7, s.periods.d7),
      d30: keep(d30, s.periods.d30),
    },
  }));
  return (
    <StrongholdStatsTable
      {...rest}
      periods={{ h24: h24.stats, d7: d7.stats, d30: d30.stats }}
      periodHeads={[
        <StatWindowHead key={0} slot={0} truncated={h24.truncated} from={h24.from} />,
        <StatWindowHead key={1} slot={1} truncated={d7.truncated} from={d7.from} />,
        <StatWindowHead key={2} slot={2} truncated={d30.truncated} from={d30.from} />,
      ]}
      sections={windowedSections}
    />
  );
}
