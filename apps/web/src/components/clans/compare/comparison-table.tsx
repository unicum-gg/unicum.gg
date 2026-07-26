"use client";

import { bestIndex, type MetricRow } from "@/components/compare/cells";
import { ClanTag } from "@/components/entity/clan-tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ClanTankAggregate } from "@unicum.gg/core/clans/repository/tanks";
import { type ClanMemberStats, type VehicleMeta, RATING_COLOR_CLASS } from "@unicum.gg/shared";
import type { ClanFullInfo } from "@unicum.gg/core/wargaming/wot/clans/info";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";

export type ClanCompareSlot = {
  requested: string;
  clan: ClanFullInfo | null;
  members: ClanMemberStats[];
  tankAggregates: ClanTankAggregate[];
};

export type AggregateStats = {
  battles: number;
  wins: number;
  damageDealt: number;
  frags: number;
  spotted: number;
  droppedCapturePoints: number;
  radioAssisted: number;
  trackAssisted: number;
  xp: number;
};

export function aggregateClanTanks(
  aggregates: ClanTankAggregate[],
): AggregateStats {
  const out: AggregateStats = {
    battles: 0,
    wins: 0,
    damageDealt: 0,
    frags: 0,
    spotted: 0,
    droppedCapturePoints: 0,
    radioAssisted: 0,
    trackAssisted: 0,
    xp: 0,
  };
  for (const t of aggregates) {
    out.battles += t.battles;
    out.wins += t.wins;
    out.damageDealt += t.damageDealt;
    out.frags += t.frags;
    out.spotted += t.spotted;
    out.droppedCapturePoints += t.droppedCapturePoints;
    out.radioAssisted += t.radioAssistedDamage;
    out.trackAssisted += t.trackAssistedDamage;
    out.xp += t.xp;
  }
  return out;
}

export function clanAggregatesToTankStats(
  aggregates: ClanTankAggregate[],
): TankStats[] {
  return aggregates.map((a) => ({
    tank_id: a.tankId,
    mark_of_mastery: null,
    all: {
      battles: a.battles,
      wins: a.wins,
      damage_dealt: a.damageDealt,
      spotted: a.spotted,
      frags: a.frags,
      dropped_capture_points: a.droppedCapturePoints,
      radio_assisted_damage: a.radioAssistedDamage,
      track_assisted_damage: a.trackAssistedDamage,
      xp: a.xp,
    },
  }));
}

export function computeAvgTier(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  let weighted = 0;
  let total = 0;
  for (const tank of tanks) {
    const meta = encyclopedia[String(tank.tank_id)];
    const battles = tank.all?.battles ?? 0;
    if (!meta || battles <= 0) continue;
    weighted += meta.tier * battles;
    total += battles;
  }
  return total > 0 ? weighted / total : null;
}

export function ComparisonTable({
  slots,
  rows,
  headerWinners,
}: {
  slots: ClanCompareSlot[];
  rows: MetricRow[];
  headerWinners?: Set<number>;
}) {
  return (
    <Table className="my-0! table-fixed [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_tbody_td]:whitespace-nowrap [&_thead_th:first-child]:pl-4! [&_tbody_tr]:border-b [&_tbody_tr]:border-fd-border [&_thead_tr]:border-b [&_thead_tr]:border-fd-border [&_td]:border-r [&_th]:border-r [&_td]:border-fd-border [&_th]:border-fd-border [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
      <TableHeader>
        <TableRow>
          <TableHead className="w-48">Stat</TableHead>
          {slots.map((s, idx) => (
            <TableHead key={`${s.requested}-${idx}`} className="text-right">
              <span className="inline-flex items-center justify-end gap-1.5">
                <ClanTag
                  tag={s.clan?.tag ?? s.requested}
                  color={s.clan?.color ?? null}
                  className="font-mono"
                />
                {headerWinners?.has(idx) && (
                  <span
                    aria-hidden
                    className="inline-block size-1.5 rounded-full bg-fd-primary"
                  />
                )}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const best = bestIndex(row.cells, row.kind);
          return (
            <TableRow key={row.label}>
              <TableCell className="font-medium">{row.label}</TableCell>
              {row.cells.map((cell, i) => (
                <TableCell
                  key={i}
                  className={cn(
                    "text-right tabular-nums",
                    cell.color
                      ? RATING_COLOR_CLASS[cell.color]
                      : cell.display === "—" && "text-muted-foreground",
                  )}
                >
                  {cell.displayNode ?? cell.display}
                  {best.has(i) && row.cells.length > 1 && (
                    <span
                      aria-hidden
                      className="ms-1 inline-block size-1.5 rounded-full bg-fd-primary align-middle"
                    />
                  )}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
