"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { VehicleMeta } from "@/services/wargaming/wot/encyclopedia";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  wn7Color,
  wn8Color,
  type WNXExpected,
  wnxColor,
} from "@/services/wargaming/wot/ratings";
import type { TankStats } from "@/services/wargaming/wot/tanks";
import {
  aggregateTanks,
  avgCell,
  bestIndex,
  type CompareSlot,
  ComparisonTable,
  computeAvgTier,
  dec2Fmt,
  intFmt,
  type MetricCell,
  type MetricRow,
  numCell,
  ratingCell,
  winratePctCell,
} from "./comparison-table";

export type BucketKey = "class" | "tier";

const CLASS_LABEL: Record<string, string> = {
  heavyTank: "Heavy",
  mediumTank: "Medium",
  lightTank: "Light",
  "AT-SPG": "TD",
  SPG: "SPG",
};
const CLASS_ORDER = ["heavyTank", "mediumTank", "lightTank", "AT-SPG", "SPG"];

function bucket(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
  by: BucketKey,
): Map<string, TankStats[]> {
  const out = new Map<string, TankStats[]>();
  for (const t of tanks) {
    const meta = encyclopedia[String(t.tank_id)];
    if (!meta) continue;
    const key = by === "class" ? meta.type : String(meta.tier);
    const arr = out.get(key);
    if (arr) arr.push(t);
    else out.set(key, [t]);
  }
  return out;
}

function orderKeys(keys: string[], by: BucketKey): string[] {
  if (by === "class") {
    return CLASS_ORDER.filter((c) => keys.includes(c)).concat(
      keys.filter((k) => !CLASS_ORDER.includes(k)),
    );
  }
  return [...keys].sort((a, b) => Number(b) - Number(a));
}

export function BucketTab({
  slots,
  encyclopedia,
  wn8Expected,
  wnxExpected,
  bucketKey,
}: {
  slots: CompareSlot[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  bucketKey: BucketKey;
}) {
  const wn8Fallback = useMemo(
    () => buildWN8Fallback(wn8Expected, encyclopedia),
    [wn8Expected, encyclopedia],
  );

  const data = useMemo(() => {
    const slotBuckets = slots.map((s) =>
      bucket(s.tanks, encyclopedia, bucketKey),
    );
    const allKeys = new Set<string>();
    for (const b of slotBuckets) for (const k of b.keys()) allKeys.add(k);
    return { slotBuckets, keys: orderKeys(Array.from(allKeys), bucketKey) };
  }, [slots, encyclopedia, bucketKey]);

  if (data.keys.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Not enough tank data to compare.
      </p>
    );
  }

  return (
    <div>
      {data.keys.map((key, idx) => {
        const sections = slots.map(
          (_, i) => data.slotBuckets[i].get(key) ?? [],
        );
        const aggs = sections.map((t) => aggregateTanks(t));
        const wn7s = sections.map((t, i) => {
          const a = aggs[i];
          if (a.battles === 0) return null;
          const avgTier = computeAvgTier(t, encyclopedia);
          return computeWN7(
            {
              battles: a.battles,
              wins: a.wins,
              frags: a.frags,
              damageDealt: a.damageDealt,
              spotted: a.spotted,
              droppedCapturePoints: a.droppedCapturePoints,
            },
            avgTier,
          );
        });
        const wn8s = sections.map((t) =>
          t.length > 0
            ? computeWN8(t, wn8Expected, encyclopedia, wn8Fallback)
            : null,
        );
        const wnxs = sections.map((t) =>
          t.length > 0 ? computeWNX(t, wnxExpected) : null,
        );
        const wn8MetricCells: MetricCell[] = wn8s.map((v) =>
          ratingCell(v, wn8Color),
        );
        const headerWinners = bestIndex(wn8MetricCells, "higher");

        const rows: MetricRow[] = [
          {
            label: "Battles",
            kind: "higher",
            cells: aggs.map((a) => numCell(a.battles, intFmt)),
          },
          {
            label: "Win rate",
            kind: "higher",
            cells: aggs.map((a) => winratePctCell(a.wins, a.battles)),
          },
          {
            label: "WN7",
            kind: "higher",
            cells: wn7s.map((v) => ratingCell(v, wn7Color)),
          },
          {
            label: "WN8",
            kind: "higher",
            cells: wn8s.map((v) => ratingCell(v, wn8Color)),
          },
          {
            label: "WNX",
            kind: "higher",
            cells: wnxs.map((v) => ratingCell(v, wnxColor)),
          },
          {
            label: "Avg damage",
            kind: "higher",
            cells: aggs.map((a) => avgCell(a.damageDealt, a.battles)),
          },
          {
            label: "Avg frags",
            kind: "higher",
            cells: aggs.map((a) => avgCell(a.frags, a.battles, dec2Fmt)),
          },
          {
            label: "Avg spots",
            kind: "higher",
            cells: aggs.map((a) => avgCell(a.spotted, a.battles, dec2Fmt)),
          },
          {
            label: "Avg XP",
            kind: "higher",
            cells: aggs.map((a) => avgCell(a.xp, a.battles)),
          },
        ];

        const title =
          bucketKey === "class" ? CLASS_LABEL[key] || key : `Tier ${key}`;

        return (
          <div key={key}>
            <h3
              className={cn(
                "border-b border-fd-border px-4 py-2 text-sm font-semibold text-fd-muted-foreground uppercase tracking-wide",
                idx > 0 && "border-t",
              )}
            >
              {title}
            </h3>
            <ComparisonTable
              slots={slots}
              rows={rows}
              headerWinners={headerWinners}
            />
          </div>
        );
      })}
    </div>
  );
}
