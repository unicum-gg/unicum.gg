"use client";

import { useLocale } from "@onruntime/translations/react";
import { useFormat } from "@/hooks/use-format";
import { useMemo } from "react";
import { LanguageFlags } from "@/components/language-flags";
import type { Region } from "@unicum.gg/wargaming";
import { weightedAverage, type WeightedDataPoint, type ClanMemberStats, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import {
  bestIndex,
  dashCell,
  INT_FORMAT,
  type MetricCell,
  type MetricRow,
  numCell,
  ratingCell,
  winratePctCell,
} from "@/components/compare/cells";
import { type ClanCompareSlot, ComparisonTable } from "./comparison-table";

const DAY_FORMAT_PATTERN = "d MMM yyyy";

function overallPoints(
  members: ClanMemberStats[],
  getValue: (m: ClanMemberStats) => number | null,
): WeightedDataPoint[] {
  const points: WeightedDataPoint[] = [];
  for (const m of members) {
    const value = getValue(m);
    if (value === null || !m.overall || m.overall.battles <= 0) continue;
    points.push({ value, weight: m.overall.battles });
  }
  return points;
}

function d30Points(
  members: ClanMemberStats[],
  getValue: (m: ClanMemberStats) => number | null,
): WeightedDataPoint[] {
  const points: WeightedDataPoint[] = [];
  for (const m of members) {
    const value = getValue(m);
    if (value === null || m.battles30d === null || m.battles30d <= 0) continue;
    points.push({ value, weight: m.battles30d });
  }
  return points;
}

function ageInDays(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function OverallTab({
  region,
  slots,
}: {
  region: Region;
  slots: ClanCompareSlot[];
}) {
  const { locale } = useLocale();
  const { date } = useFormat();
  const { rows, headerWinners } = useMemo(() => {
    function buildRow(
      label: string,
      kind: "higher" | "lower",
      build: (slot: ClanCompareSlot) => MetricCell,
    ): MetricRow {
      return {
        label,
        kind,
        cells: slots.map((s) => (s.clan ? build(s) : dashCell())),
      };
    }

    const wn8Cells: MetricCell[] = slots.map((s) =>
      s.clan
        ? ratingCell(
            weightedAverage(overallPoints(s.members, (m) => m.wn8)),
            wn8Color,
          locale,
        )
        : dashCell(),
    );

    const allRows: MetricRow[] = [
      buildRow("Members", "higher", (s) =>
        numCell(s.clan!.membersCount, locale, INT_FORMAT),
      ),
      buildRow("Active members (30d)", "higher", (s) => {
        const active = s.members.filter(
          (m) => (m.battles30d ?? 0) > 0,
        ).length;
        return numCell(active, locale, INT_FORMAT);
      }),
      buildRow("Avg WR", "higher", (s) => {
        const totalBattles = s.members.reduce(
          (acc, m) => acc + (m.overall?.battles ?? 0),
          0,
        );
        const totalWins = s.members.reduce(
          (acc, m) =>
            acc +
            (m.overall ? (m.overall.battles * m.overall.winsPercentage) / 100 : 0),
          0,
        );
        return winratePctCell(totalWins, totalBattles, locale);
      }),
      {
        label: "Avg WN7",
        kind: "higher",
        cells: slots.map((s) =>
          s.clan
            ? ratingCell(
                weightedAverage(overallPoints(s.members, (m) => m.wn7)),
                wn7Color,
              locale,
            )
            : dashCell(),
        ),
      },
      {
        label: "Avg WN8",
        kind: "higher",
        cells: wn8Cells,
      },
      {
        label: "Avg WNX",
        kind: "higher",
        cells: slots.map((s) =>
          s.clan
            ? ratingCell(
                weightedAverage(overallPoints(s.members, (m) => m.wnx)),
                wnxColor,
              locale,
            )
            : dashCell(),
        ),
      },
      {
        label: "Avg WN7 · 30d",
        kind: "higher",
        cells: slots.map((s) =>
          s.clan
            ? ratingCell(
                weightedAverage(d30Points(s.members, (m) => m.wn730d)),
                wn7Color,
              locale,
            )
            : dashCell(),
        ),
      },
      {
        label: "Avg WN8 · 30d",
        kind: "higher",
        cells: slots.map((s) =>
          s.clan
            ? ratingCell(
                weightedAverage(d30Points(s.members, (m) => m.wn830d)),
                wn8Color,
              locale,
            )
            : dashCell(),
        ),
      },
      {
        label: "Avg WNX · 30d",
        kind: "higher",
        cells: slots.map((s) =>
          s.clan
            ? ratingCell(
                weightedAverage(d30Points(s.members, (m) => m.wnx30d)),
                wnxColor,
              locale,
            )
            : dashCell(),
        ),
      },
      buildRow("Age (days)", "higher", (s) =>
        numCell(ageInDays(s.clan!.createdAt), locale, INT_FORMAT),
      ),
      buildRow("Created", "lower", (s) => ({
        display: date(DAY_FORMAT_PATTERN).format(s.clan!.createdAt),
        numeric: s.clan!.createdAt.getTime(),
      })),
      buildRow("Languages", "higher", (s) => {
        const langs = s.clan!.languages;
        if (langs.length === 0) {
          return { display: "—", numeric: 0 };
        }
        return {
          display: langs.map((l) => l.toUpperCase()).join(", "),
          displayNode: (
            <span className="inline-flex justify-end">
              <LanguageFlags
                languages={langs}
                size="s"
                source="declared"
                region={region}
              />
            </span>
          ),
          numeric: langs.length,
        };
      }),
    ];

    return {
      rows: allRows,
      headerWinners: bestIndex(wn8Cells, "higher"),
    };
  }, [slots, region, date, locale]);

  return (
    <ComparisonTable slots={slots} rows={rows} headerWinners={headerWinners} />
  );
}
