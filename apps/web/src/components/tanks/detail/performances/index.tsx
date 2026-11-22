import { numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import type {
  VehicleMeta,
  WN8Expected,
  WNXExpected,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type {
  TankServerStats,
  TopTankPlayersByMetric,
} from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import type { TankTwin } from "@unicum.gg/core/wargaming/wot/tanks/twins";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TwinsView } from "@/components/tanks/detail/twins/control";
import { TwinsPanel } from "@/components/tanks/detail/twins/panel";
import { PerformanceFigures } from "./figures";
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

/** The Performances tab: server-average stats, top players per rating metric,
 * and the WN8/WNX expected values. A vehicle with twins offers to read the
 * first two across them. */
export async function Performances({
  region,
  tankId,
  meta,
  serverStats,
  topByMetric,
  wn8Expected,
  wnxExpected,
  twins,
  withTwins,
  locale,
}: {
  region: Region;
  tankId: number;
  meta: VehicleMeta;
  serverStats: TankServerStats | null;
  topByMetric: TopTankPlayersByMetric;
  wn8Expected: WN8Expected | null;
  wnxExpected: WNXExpected | null;
  /** The vehicles that are this one under another name (see `getTankTwins`). */
  twins: TankTwin[];
  /** The figures above read across this vehicle and its twins. */
  withTwins: {
    serverStats: TankServerStats | null;
    topByMetric: TopTankPlayersByMetric;
  } | null;
  locale: string;
}) {
  const { t } = await getTranslation("components/tanks/detail/performances/index", locale);
  const figures = (
    <PerformanceFigures
      region={region}
      meta={meta}
      serverStats={serverStats}
      topByMetric={topByMetric}
      locale={locale}
    />
  );
  return (
    <>
      {withTwins && twins.length > 0 ? (
        <>
          <TwinsPanel
            region={region}
            tankName={meta.name}
            twins={twins}
            players={serverStats?.players}
            combinedPlayers={withTwins.serverStats?.players}
            tab="/performances"
            locale={locale}
          />
          <PanelSeparator />
          <TwinsView
            own={figures}
            combined={
              <PerformanceFigures
                region={region}
                // Named for every vehicle it counts, so a heading over 24,836
                // players does not read as the 3 of the page's own.
                meta={{
                  ...meta,
                  name: [meta.name, ...twins.map((twin) => twin.name)].join(" + "),
                  shortName: [meta.shortName, ...twins.map((twin) => twin.name)].join(" + "),
                }}
                serverStats={withTwins.serverStats}
                topByMetric={withTwins.topByMetric}
                twinNames={Object.fromEntries(twins.map((twin) => [twin.tankId, twin.name]))}
                locale={locale}
              />
            }
          />
        </>
      ) : (
        figures
      )}

      {(wn8Expected || wnxExpected) && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{t("expected-values", { tank: meta.name })}</PanelTitle>
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
