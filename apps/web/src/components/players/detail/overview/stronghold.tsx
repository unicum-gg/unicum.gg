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
import Link from "@/components/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { styles } from "@/lib/styles";
import { tankModeName } from "@/components/game-name";
import { withTankMode } from "@/hooks/use-tank-mode";
import { cn } from "@/lib/utils";
import type { StrongholdStats, TankBattleMode } from "@unicum.gg/shared";

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
  tankView,
  tanksHref,
}: {
  nickname: string;
  label: string;
  data: StrongholdData;
  trailingRows?: RowDef[];
  winrateColorFn?: WinrateColorFn;
  /** The per-vehicle view this mode leads to, where Wargaming reports one.
   * Absent for the modes it does not; see `PLAYER_MODE_TANK_VIEW`. */
  tankView?: TankBattleMode;
  /** The Tanks tab's own path, which the link above is built from. */
  tanksHref?: string;
}) {
  const { t } = useTranslation("components/players/detail/overview/stronghold");
  const { t: tGame } = useTranslation("game/vocabulary");
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
          {/* The way through to the same mode vehicle by vehicle, which nothing
              else on the page points at. Named after the DESTINATION rather
              than the tab it sits under: the three Clan Wars tabs all land on
              Global Map, because Wargaming splits the account figure by tier
              and does not split the per-vehicle one. */}
          {tankView && tanksHref && data.current !== null ? (
            <div className="border-t border-fd-border p-4">
              <Link
                href={withTankMode(tanksHref, tankView)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-sm font-medium",
                  "text-fd-muted-foreground transition-colors hover:text-fd-foreground",
                )}
              >
                {t("see-tank-by-tank", {
                  mode: tankModeName(tankView, tGame),
                })}
                <ArrowRightIcon className="size-3.5" aria-hidden />
              </Link>
            </div>
          ) : null}
        </PanelContent>
      </Panel>
    </>
  );
}
