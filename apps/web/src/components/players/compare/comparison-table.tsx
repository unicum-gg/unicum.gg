"use client";

import { bestIndex, type MetricRow } from "@/components/compare/cells";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Player, PlayerSnapshot } from "@unicum.gg/core/db/schema";
import type { VehicleMeta } from "@unicum.gg/core/wargaming/wot/tanks/meta";
import { RATING_COLOR_CLASS } from "@unicum.gg/core/wargaming/wot/ratings";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";

export type CompareSlot = {
  requested: string;
  player: Player | null;
  latest: PlayerSnapshot | null;
  tanks: TankStats[];
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

export function emptyAggregate(): AggregateStats {
  return {
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
}

export function aggregateTanks(tanks: TankStats[]): AggregateStats {
  const agg = emptyAggregate();
  for (const t of tanks) {
    agg.battles += t.all.battles;
    agg.wins += t.all.wins;
    agg.damageDealt += t.all.damage_dealt;
    agg.frags += t.all.frags;
    agg.spotted += t.all.spotted;
    agg.droppedCapturePoints += t.all.dropped_capture_points;
    agg.radioAssisted += t.all.radio_assisted_damage;
    agg.trackAssisted += t.all.track_assisted_damage;
    agg.xp += Number.isFinite(t.all.xp) ? t.all.xp : 0;
  }
  return agg;
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
  slots: CompareSlot[];
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
                {s.player?.nickname ?? s.requested}
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
