import { numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import { Interpolate } from "@/components/interpolate";
import type { ReactNode } from "react";
import {
  RATING_METRIC_LABEL,
  RATING_METRICS,
  RatingMetric,
  type VehicleMeta,
  RATING_COLOR_CLASS,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/shared";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";
import type {
  TankServerStats,
  TopTankPlayersByMetric,
} from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { TankTopPlayers } from "./top-players";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { cn } from "@/lib/utils";

const RATING_COL: Record<RatingMetric, "wn7" | "wn8" | "wnx"> = {
  [RatingMetric.Wn7]: "wn7",
  [RatingMetric.Wn8]: "wn8",
  [RatingMetric.Wnx]: "wnx",
};

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DEC_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PCT_FORMAT = {
  style: "percent",
  maximumFractionDigits: 1,
} as const;

/** The Performances tab: server-average stats, top players per rating metric,
 * and the WN8/WNX expected values. */
export async function Performances({
  region,
  tankId,
  meta,
  serverStats,
  topByMetric,
  wn8Expected,
  wnxExpected, locale,
}: {
  region: Region;
  tankId: number;
  meta: VehicleMeta;
  serverStats: TankServerStats | null;
  topByMetric: TopTankPlayersByMetric;
  wn8Expected: WN8Expected | null;
  wnxExpected: WNXExpected | null;
  locale: string;
}) {
  const { t } = await getTranslation("components/tanks/detail/performances/index", locale);
  return (
    <>
      {serverStats && (
        <>
          <Panel>
            <PanelHeader>
              <PanelTitle>{t("server-average", { name: meta.name })}</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-3 p-4">
              <p className="text-sm text-fd-muted-foreground">
                {t("how-the-average-performs", {
                  region: REGION_LABEL[region],
                  tank: meta.shortName,
                  players: numberFormat(locale, INT_FORMAT).format(serverStats.players),
                })}
                {serverStats.total_battles !== null
                  ? t("with-battles", {
                      battles: numberFormat(locale, INT_FORMAT).format(serverStats.total_battles),
                    })
                  : t("min-battles-each")}
                ).
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Stat
                  label={t("avg-battles")}
                  value={numberFormat(locale, INT_FORMAT).format(serverStats.avg_battles)}
                />
                <Stat
                  label={t("avg-damage")}
                  value={numberFormat(locale, INT_FORMAT).format(serverStats.avg_damage)}
                />
                <Stat
                  label={t("win-rate")}
                  value={numberFormat(locale, PCT_FORMAT).format(serverStats.winrate / 100)}
                  colorClass={
                    RATING_COLOR_CLASS[winrateColor(serverStats.winrate / 100)]
                  }
                />
                <Stat
                  label={t("player-wr")}
                  value={
                    serverStats.player_wr !== null
                      ? numberFormat(locale, PCT_FORMAT).format(serverStats.player_wr / 100)
                      : "—"
                  }
                  colorClass={
                    serverStats.player_wr !== null
                      ? RATING_COLOR_CLASS[
                          winrateColor(serverStats.player_wr / 100)
                        ]
                      : undefined
                  }
                />
                {/* Only the card matching the active rating metric shows, via
                    the html[data-rating-metric] cookie-painted CSS toggle. */}
                <div className="contents" data-rating-col="wn7">
                  <Stat
                    label={<RatingMetricInlineSelect />}
                    value={
                      serverStats.wn7 !== null
                        ? numberFormat(locale, INT_FORMAT).format(serverStats.wn7)
                        : "—"
                    }
                    colorClass={
                      serverStats.wn7 !== null
                        ? RATING_COLOR_CLASS[wn7Color(serverStats.wn7)]
                        : undefined
                    }
                  />
                </div>
                <div className="contents" data-rating-col="wn8">
                  <Stat
                    label={<RatingMetricInlineSelect />}
                    value={
                      serverStats.wn8 !== null
                        ? numberFormat(locale, INT_FORMAT).format(serverStats.wn8)
                        : "—"
                    }
                    colorClass={
                      serverStats.wn8 !== null
                        ? RATING_COLOR_CLASS[wn8Color(serverStats.wn8)]
                        : undefined
                    }
                  />
                </div>
                <div className="contents" data-rating-col="wnx">
                  <Stat
                    label={<RatingMetricInlineSelect />}
                    value={
                      serverStats.wnx !== null
                        ? numberFormat(locale, INT_FORMAT).format(serverStats.wnx)
                        : "—"
                    }
                    colorClass={
                      serverStats.wnx !== null
                        ? RATING_COLOR_CLASS[wnxColor(serverStats.wnx)]
                        : undefined
                    }
                  />
                </div>
                <Stat
                  label={t("assists")}
                  value={
                    serverStats.avg_assist !== null
                      ? numberFormat(locale, INT_FORMAT).format(serverStats.avg_assist)
                      : "—"
                  }
                />
                <Stat
                  label={t("spots")}
                  value={
                    serverStats.avg_spots !== null
                      ? numberFormat(locale, DEC_FORMAT).format(serverStats.avg_spots)
                      : "—"
                  }
                />
                <Stat
                  label={t("kdr")}
                  value={
                    serverStats.kdr !== null
                      ? numberFormat(locale, DEC_FORMAT).format(serverStats.kdr)
                      : "—"
                  }
                />
                <Stat
                  label={t("hit")}
                  value={
                    serverStats.hit_pct !== null
                      ? numberFormat(locale, PCT_FORMAT).format(serverStats.hit_pct / 100)
                      : "—"
                  }
                />
                <Stat
                  label={t("pen")}
                  value={
                    serverStats.pen_pct !== null
                      ? numberFormat(locale, PCT_FORMAT).format(serverStats.pen_pct / 100)
                      : "—"
                  }
                />
                <Stat
                  label={t("blocked")}
                  value={
                    serverStats.avg_blocked !== null
                      ? numberFormat(locale, INT_FORMAT).format(serverStats.avg_blocked)
                      : "—"
                  }
                />
                <Stat
                  label={t("survival")}
                  value={
                    serverStats.survival !== null
                      ? numberFormat(locale, PCT_FORMAT).format(serverStats.survival / 100)
                      : "—"
                  }
                />
              </div>
            </PanelContent>
          </Panel>
          <PanelSeparator />
        </>
      )}

      <Panel>
        <PanelHeader className="flex items-center justify-between gap-3">
          <PanelTitle>
            <Interpolate
              template={t("top-tank-players-by", { tank: meta.name })}
              values={{
                by: (
                  <span className="text-fd-muted-foreground">{t("by")}</span>
                ),
                metric: <RatingMetricInlineSelect />,
              }}
            />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-3 text-sm text-fd-muted-foreground">
            {t("best-players-on-ranked-by", { shortName: meta.shortName, region: REGION_LABEL[region] })}</div>
          {RATING_METRICS.map((m) => (
            <div key={m} data-rating-col={RATING_COL[m]}>
              <TankTopPlayers
                players={topByMetric[m]}
                metric={m}
                metricLabel={RATING_METRIC_LABEL[m]}
                region={region}
              />
            </div>
          ))}
        </PanelContent>
      </Panel>

      {(wn8Expected || wnxExpected) && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{t("expected-values", { name: meta.name })}</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-4 p-4">
              <p className="text-sm text-fd-muted-foreground">
                {t("reference-targets-for-an-average")}</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {wn8Expected && (
                  <>
                    <Stat label={t("exp-damage-wn8")} value={numberFormat(locale, INT_FORMAT).format(wn8Expected.expDamage)} />
                    <Stat label={t("exp-frags-wn8")} value={numberFormat(locale, DEC_FORMAT).format(wn8Expected.expFrag)} />
                    <Stat label={t("exp-spots-wn8")} value={numberFormat(locale, DEC_FORMAT).format(wn8Expected.expSpot)} />
                    <Stat label={t("exp-win-rate-wn8")} value={numberFormat(locale, PCT_FORMAT).format(wn8Expected.expWinRate / 100)} />
                  </>
                )}
                {wnxExpected && (
                  <>
                    <Stat label={t("exp-damage-wnx")} value={numberFormat(locale, INT_FORMAT).format(wnxExpected.damage)} />
                    <Stat label={t("exp-frags-wnx")} value={numberFormat(locale, DEC_FORMAT).format(wnxExpected.frags)} />
                    <Stat label={t("exp-spots-wnx")} value={numberFormat(locale, DEC_FORMAT).format(wnxExpected.spots)} />
                    <Stat label={t("exp-assist-wnx")} value={numberFormat(locale, INT_FORMAT).format(wnxExpected.assist)} />
                  </>
                )}
              </div>
              <p className="text-xs text-fd-muted-foreground">
                {t("tank-id-expected-values-are", { tankId })}</p>
            </PanelContent>
          </Panel>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  colorClass,
}: {
  label: ReactNode;
  value: string;
  colorClass?: string;
}) {
  // Each stat is a framed card. A rating stat (WN8/WNX) colours the whole card
  // with its rating colour + white text, instead of a bare pill floating around
  // the number among unframed stats.
  const colored = !!colorClass;
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        colored ? cn(colorClass, "border-transparent") : "border-fd-border",
      )}
    >
      {/* Fixed-height, centered label row so a card whose label is a taller
          control (the rating metric select) keeps its value aligned with the
          plain-text cards. */}
      <div
        className={cn(
          "flex h-6 items-center text-xs uppercase tracking-wide",
          colored ? "text-white/75" : "text-fd-muted-foreground",
        )}
      >
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
