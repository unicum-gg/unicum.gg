import { numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import { Interpolate } from "@/components/interpolate";
import {
  RATING_METRIC_LABEL,
  WN_RATING_METRICS,
  type VehicleMeta,
  RATING_COLOR_CLASS,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";
import type {
  TankServerStats,
  TopTankPlayersByMetric,
} from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { RatingFallbackNote } from "@/components/rating-fallback-note";
import { RatingFallbackReason } from "@/components/rating-fallback-reason";
import { TankTopPlayers } from "./top-players";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Stat } from "./stat";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DEC_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PCT_FORMAT = {
  style: "percent",
  maximumFractionDigits: 1,
} as const;

/**
 * The server averages and the top players of the Performances tab, for one
 * reading of the vehicle: on its own, or with its twins (see `TwinsView`). The
 * expected values stay outside, since they belong to this id alone.
 */
export async function PerformanceFigures({
  region,
  meta,
  serverStats,
  topByMetric,
  twinNames,
  locale,
}: {
  region: Region;
  meta: VehicleMeta;
  serverStats: TankServerStats | null;
  topByMetric: TopTankPlayersByMetric;
  /** The twins' names by id, on the reading that includes them, so a row
   * earned on one says so. */
  twinNames?: Record<number, string>;
  locale: string;
}) {
  const { t } = await getTranslation("components/tanks/detail/performances/index", locale);
  return (
    <>
      {serverStats && (
        <>
          <Panel>
            <PanelHeader>
              <PanelTitle>{t("server-average", { tank: meta.name })}</PanelTitle>
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
                    the html[data-rating-wn] cookie-painted CSS toggle: a
                    vehicle has no PR or WTR, so those show the WNX card. */}
                <div className="contents" data-rating-wn-col="wn7">
                  <Stat
                    label={<RatingMetricInlineSelect wnOnly />}
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
                <div className="contents" data-rating-wn-col="wn8">
                  <Stat
                    label={<RatingMetricInlineSelect wnOnly />}
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
                <div className="contents" data-rating-wn-col="wnx">
                  <Stat
                    label={<RatingMetricInlineSelect wnOnly />}
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
                metric: <RatingMetricInlineSelect wnOnly />,
              }}
            />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-3 text-sm text-fd-muted-foreground">
            {t("best-players-on-ranked-by", { shortName: meta.shortName, region: REGION_LABEL[region] })}
            <RatingFallbackNote
              reason={RatingFallbackReason.Vehicle}
              className="mt-1"
            />
          </div>
          {WN_RATING_METRICS.map((m) => (
            <div key={m} data-rating-wn-col={m}>
              <TankTopPlayers
                players={topByMetric[m]}
                metric={m}
                metricLabel={RATING_METRIC_LABEL[m]}
                region={region}
                twinNames={twinNames}
              />
            </div>
          ))}
        </PanelContent>
      </Panel>

    </>
  );
}
