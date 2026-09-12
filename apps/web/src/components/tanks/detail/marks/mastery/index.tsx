import { numberFormat } from "@/lib/format";
import { statLabel } from "@/components/stat-label";
import { getTranslation } from "@/lib/translations.server";
import type { ReactNode } from "react";
import type { MomValues } from "@unicum.gg/core/mom";
import type { MomHistoryPoint } from "@unicum.gg/core/mom/poliroid";
import type { MoeValues } from "@unicum.gg/core/moe";
import type { MoeHistoryPoint } from "@unicum.gg/core/moe/poliroid";
import type { TankServerStats } from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import { MOE_COLORS, MoEIcon } from "@/components/tanks/moe-icon";
import { MOM_COLORS, MoMIcon } from "@/components/tanks/mom-icon";
import { MarksHistoryChart } from "@/components/tanks/detail/marks/mastery/history-chart-lazy";
import type { MarksSeries } from "@/components/tanks/detail/marks/mastery/history-chart";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

// Rows are listed hardest-first so the top row lines up with the top line on the
// chart (both descend by threshold). `mastery` is the mark_of_mastery value the
// MoMIcon renders (4 Ace / 3 1st / 2 2nd / 1 3rd).
// `holdersKey` picks the cumulative tracked-player count for this level off the
// server-stats row.
const MOM_ROWS: {
  key: keyof MomValues;
  label: string;
  mastery: 1 | 2 | 3 | 4;
  holdersKey: keyof TankServerStats;
}[] = [
  { key: "ace", label: "Ace Tanker", mastery: 4, holdersKey: "mom_ace" },
  { key: "class1", label: "1st Class", mastery: 3, holdersKey: "mom_class1" },
  { key: "class2", label: "2nd Class", mastery: 2, holdersKey: "mom_class2" },
  { key: "class3", label: "3rd Class", mastery: 1, holdersKey: "mom_class3" },
];

const MOE_ROWS: {
  key: keyof MoeValues;
  label: string;
  bars: 1 | 2 | 3;
  holdersKey: keyof TankServerStats;
}[] = [
  { key: "mark3", label: "3 Marks", bars: 3, holdersKey: "moe3" },
  { key: "mark2", label: "2 Marks", bars: 2, holdersKey: "moe2" },
  { key: "mark1", label: "1 Mark", bars: 1, holdersKey: "moe1" },
];

// Chart line colours share the icon palettes: MoE the marks prestige ramp
// (bronze → silver → gold), MoM the mastery ramp (gold Ace → silver → light
// bronze → dark bronze). Both are ordered hardest-first so the legend and hover
// tooltip read top-down like the values table.
const MOE_SERIES: MarksSeries[] = [
  { key: "mark3", label: "3 Marks", color: MOE_COLORS[3] },
  { key: "mark2", label: "2 Marks", color: MOE_COLORS[2] },
  { key: "mark1", label: "1 Mark", color: MOE_COLORS[1] },
];
const MOM_SERIES: MarksSeries[] = [
  { key: "ace", label: "Ace Tanker", color: MOM_COLORS[4] },
  { key: "class1", label: "1st Class", color: MOM_COLORS[3] },
  { key: "class2", label: "2nd Class", color: MOM_COLORS[2] },
  { key: "class3", label: "3rd Class", color: MOM_COLORS[1] },
];

const seriesColor = (series: MarksSeries[], key: string) =>
  series.find((s) => s.key === key)?.color ?? "currentColor";

// Cumulative count of tracked players who reached this level. Null until the
// by-tank cron has computed it (and, for MoE, as players get portal-refreshed).
async function HolderLine({
  count,
  locale,
}: {
  count: number | null;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/tanks/detail/marks/mastery/index",
    locale,
  );
  if (count == null) return null;
  return (
    <span className="block text-xs font-normal text-fd-muted-foreground tabular-nums">
      {t("n-players", {
        count: numberFormat(locale, INT_FORMAT).format(count),
      })}
    </span>
  );
}

// One section is a single Panel (so it carries exactly one set of full-width
// screen lines, like every other section) split internally into a values column
// (1/3) and a chart column (2/3). The split uses plain contained borders — a
// vertical divider from `lg` up, a horizontal one when the columns stack below
// `lg` — so nothing overlaps the way two adjacent screen-lined panels would.
async function MarksSection({
  title,
  description,
  values,
  chart,
  chartDays, locale,
}: {
  title: string;
  description: string;
  values: ReactNode;
  chart: ReactNode | null;
  chartDays: number;
  locale: string;
}) {
  const { t } = await getTranslation("components/tanks/detail/marks/mastery/index", locale);
  const valuesColumn = (
    <>
      <PanelHeader screenLines={false} className="border-b border-fd-border">
        <PanelTitle>{title}</PanelTitle>
      </PanelHeader>
      <PanelContent>
        <p className="mb-4 text-sm text-fd-muted-foreground">{description}</p>
        <dl className="space-y-2">{values}</dl>
      </PanelContent>
    </>
  );

  if (!chart) return <Panel>{valuesColumn}</Panel>;

  return (
    <Panel>
      <div className="grid grid-cols-1 lg:grid-cols-3">
        <div className="border-b border-fd-border lg:border-r lg:border-b-0">
          {valuesColumn}
        </div>
        <div className="lg:col-span-2">
          <PanelHeader
            screenLines={false}
            className="border-b border-fd-border"
          >
            <PanelTitle>{t("last-days", { chartDays })}</PanelTitle>
          </PanelHeader>
          <PanelContent>{chart}</PanelContent>
        </div>
      </div>
    </Panel>
  );
}

export async function TankMarksMastery({
  moe,
  mom,
  moeHistory,
  momHistory,
  serverStats,
  tankName, locale,
}: {
  moe: MoeValues | null;
  mom: MomValues | null;
  moeHistory: MoeHistoryPoint[];
  momHistory: MomHistoryPoint[];
  serverStats: TankServerStats | null;
  tankName: string;
  locale: string;
}) {
  const { t: tStats } = await getTranslation("components/stat-labels", locale);
  const { t } = await getTranslation("components/tanks/detail/marks/mastery/index", locale);
  if (!moe && !mom) return null;
  return (
    <>
      {moe && (
        <MarksSection locale={locale}
          title={t("tank-marks-of-excellence", { tank: tankName })}
          description={t("rolling-average-combined-damage-to")}
          chartDays={moeHistory.length}
          chart={
            moeHistory.length >= 2 ? (
              <MarksHistoryChart
                data={moeHistory}
                series={MOE_SERIES}
                ariaLabel={`${tankName} Marks of Excellence requirements over time`}
              />
            ) : null
          }
          values={MOE_ROWS.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <dt className="flex items-center gap-2 text-fd-muted-foreground">
                <MoEIcon bars={row.bars} color={seriesColor(MOE_SERIES, row.key)} />
                {statLabel(row.label, tStats)}
              </dt>
              <dd className="text-right">
                <span className="font-semibold tabular-nums">
                  {numberFormat(locale, INT_FORMAT).format(moe[row.key])}
                </span>
                <HolderLine
                  locale={locale}
                  count={serverStats ? serverStats[row.holdersKey] : null}
                />
              </dd>
            </div>
          ))}
        />
      )}
      {moe && mom && <PanelSeparator />}
      {mom && (
        <MarksSection locale={locale}
          title={t("tank-marks-of-mastery", { tank: tankName })}
          description={t("single-battle-xp-to-beat")}
          chartDays={momHistory.length}
          chart={
            momHistory.length >= 2 ? (
              <MarksHistoryChart
                data={momHistory}
                series={MOM_SERIES}
                ariaLabel={`${tankName} Marks of Mastery thresholds over time`}
              />
            ) : null
          }
          values={MOM_ROWS.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <dt className="flex items-center gap-2 text-fd-muted-foreground">
                <MoMIcon mastery={row.mastery} className="mx-0 h-5" />
                {statLabel(row.label, tStats)}
              </dt>
              <dd className="text-right">
                <span className="font-semibold tabular-nums">
                  {numberFormat(locale, INT_FORMAT).format(mom[row.key])}
                </span>
                <HolderLine
                  locale={locale}
                  count={serverStats ? serverStats[row.holdersKey] : null}
                />
              </dd>
            </div>
          ))}
        />
      )}
    </>
  );
}
