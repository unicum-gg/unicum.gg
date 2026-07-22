"use client";

import { useMemo } from "react";
import { type VehicleMeta, computeWN7, computeWN8, computeWNX, type WN8Expected, wn7Color, wn8Color, type WNXExpected, wnxColor } from "@unicum.gg/shared";
import {
  avgCell,
  bestIndex,
  dashCell,
  dec2Fmt,
  intFmt,
  type MetricCell,
  type MetricKind,
  type MetricRow,
  numCell,
  pctCell,
  pctFmt,
  ratingCell,
  winratePctCell,
} from "@/components/compare/cells";
import {
  aggregateTanks,
  type CompareSlot,
  ComparisonTable,
  computeAvgTier,
} from "./comparison-table";

export function OverallTab({
  slots,
  encyclopedia,
  wn8Expected,
  wnxExpected,
  wn8Fallback,
}: {
  slots: CompareSlot[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  wn8Fallback: Map<string, WN8Expected>;
}) {

  const { rows, headerWinners } = useMemo(() => {
    const overallAggs = slots.map((s) => aggregateTanks(s.tanks));
    const avgTiers = slots.map((s) => computeAvgTier(s.tanks, encyclopedia));

    const wn7Values = slots.map((s, i) => {
      const latest = s.latest;
      const agg = overallAggs[i];
      const tier = avgTiers[i];
      if (!latest || agg.battles === 0) return null;
      return computeWN7(
        {
          battles: latest.battles,
          wins: latest.wins,
          frags: latest.frags,
          damageDealt: latest.damageDealt,
          spotted: latest.spotted,
          droppedCapturePoints: latest.droppedCapturePoints,
        },
        tier,
      );
    });
    const wn8Values = slots.map((s) =>
      s.tanks.length > 0
        ? computeWN8(s.tanks, wn8Expected, encyclopedia, wn8Fallback)
        : null,
    );
    const wnxValues = slots.map((s) =>
      s.tanks.length > 0 ? computeWNX(s.tanks, wnxExpected) : null,
    );

    function statRow(
      label: string,
      kind: MetricKind,
      build: (s: CompareSlot, i: number) => MetricCell,
    ): MetricRow {
      return {
        label,
        kind,
        cells: slots.map((s, i) => (s.latest ? build(s, i) : dashCell())),
      };
    }

    const wn8Cells = wn8Values.map((v) => ratingCell(v, wn8Color));
    const allRows: MetricRow[] = [
      statRow("Battles", "higher", (s) => numCell(s.latest!.battles, intFmt)),
      statRow("Win rate", "higher", (s) =>
        winratePctCell(s.latest!.wins, s.latest!.battles),
      ),
      {
        label: "WN7",
        kind: "higher",
        cells: wn7Values.map((v) => ratingCell(v, wn7Color)),
      },
      {
        label: "WN8",
        kind: "higher",
        cells: wn8Cells,
      },
      {
        label: "WNX",
        kind: "higher",
        cells: wnxValues.map((v) => ratingCell(v, wnxColor)),
      },
      statRow("WTR", "higher", (s) => numCell(s.latest!.wtr, intFmt)),
      statRow("Personal Rating", "higher", (s) =>
        numCell(s.latest!.globalRating, intFmt),
      ),
      statRow("Avg damage", "higher", (s) =>
        avgCell(s.latest!.damageDealt, s.latest!.battles),
      ),
      statRow("Avg XP", "higher", (s) =>
        avgCell(s.latest!.xp, s.latest!.battles),
      ),
      statRow("Avg frags", "higher", (s) =>
        avgCell(s.latest!.frags, s.latest!.battles, dec2Fmt),
      ),
      statRow("Avg spots", "higher", (s) =>
        avgCell(s.latest!.spotted, s.latest!.battles, dec2Fmt),
      ),
      {
        label: "Avg tier",
        kind: "higher",
        cells: avgTiers.map((t) => numCell(t, dec2Fmt)),
      },
      statRow("Accuracy", "higher", (s) => {
        if (s.latest!.shots <= 0) return dashCell();
        const ratio = s.latest!.hits / s.latest!.shots;
        return { display: pctFmt.format(ratio), numeric: ratio };
      }),
      statRow("Survivability", "higher", (s) =>
        pctCell(s.latest!.survivedBattles, s.latest!.battles),
      ),
    ];
    return {
      rows: allRows,
      headerWinners: bestIndex(wn8Cells, "higher"),
    };
  }, [slots, encyclopedia, wn8Expected, wn8Fallback, wnxExpected]);

  return (
    <ComparisonTable
      slots={slots}
      rows={rows}
      headerWinners={headerWinners}
    />
  );
}
