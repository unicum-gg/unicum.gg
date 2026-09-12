import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import {
  type PlayerDistribution,
  type ServerComparison,
  type ServerStats,
  ServerStatsRange,
  type TierWinrate,
} from "@unicum.gg/shared";
import { REGION_EMOJI, REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { BattleShares } from "./battle-shares";
import { ServersDashboard } from "./dashboard";
import { DistributionPanel } from "./distribution-panel";
import { formatMoment } from "./format";
import { ServersLiveHeader } from "./live-header";
import { TierWinratePanel } from "./tier-winrate";

/**
 * The servers page for one region.
 *
 * The default range is rendered on the server so the page has its numbers in
 * the prerendered HTML, and the range switcher takes over from there without
 * making the page dynamic. The headline count is the exception: it comes from
 * Wargaming over SSE, so it is the same instant the game shows rather than the
 * last five-minute sample.
 */

const DEFAULT_RANGE = ServerStatsRange.Day;

/** What a build with no database (or a failed endpoint) prerenders: an empty
 * shell that heals on its first revalidation, like every other `buildSafe`
 * fallback on the site. */
function emptyStats(region: Region): ServerStats {
  return {
    region,
    range: DEFAULT_RANGE,
    servers: [],
    points: [],
    clusters: [],
    current: null,
    average: 0,
    peak: null,
    trough: null,
    allTimePeak: null,
    rhythm: [],
    since: null,
  };
}

export async function ServersView({ region, locale }: { region: Region; locale: string }) {
  const { t } = await getTranslation("components/servers/index", locale);
  const [stats, comparison, distribution, tierWinrate] = await Promise.all([
    buildSafe(
      () => unicum.region(region).server.stats(DEFAULT_RANGE),
      emptyStats(region),
    ) as Promise<ServerStats>,
    buildSafe(() => unicum.servers.compare(DEFAULT_RANGE), {
      range: DEFAULT_RANGE,
      regions: [],
    }) as Promise<ServerComparison>,
    // The endpoint answers 404 until the hourly cron has run for this region,
    // which is a state the page can render rather than an error it should fail
    // on, so the whole call degrades to null. A blip degrades the same way: the
    // rest of the page is about live population and does not depend on this.
    unicum
      .region(region)
      .players.distribution()
      .then((d) => d as unknown as PlayerDistribution)
      .catch(() => null),
    // Same deal: 404 until the nightly pass has rebuilt the grid for this
    // region, which is a state the page renders by leaving the panel out.
    unicum
      .region(region)
      .players.winrateByTier()
      .then((g) => g as unknown as TierWinrate)
      .catch(() => null),
  ]);

  const label = REGION_LABEL[region];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {label}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t("title")}
              values={{
                population: (
                  <span className="text-brand">
                    {t("server-population", { label })}
                  </span>
                ),
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("how-many-players-are-on", { label })}</p>
          <div className="mt-8">
            <ServersLiveHeader
              region={region}
              fallbackTotal={stats.current}
              fallbackClusters={stats.clusters}
              rhythm={stats.rhythm}
            />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <ServersDashboard
        region={region}
        initialRange={DEFAULT_RANGE}
        initialStats={stats}
        initialComparison={comparison}
      />

      {distribution ? (
        <>
          <PanelSeparator />

          <DistributionPanel distribution={distribution} region={region} />

          <PanelSeparator />

          <Panel>
            <PanelHeader>
              <PanelTitle>{t("where-battles-are-fought", { label })}</PanelTitle>
            </PanelHeader>
            {/* Like the distribution panel: the sections carry their own
                padding so their dividing rules reach the panel's borders. */}
            <PanelContent className="p-0">
              <BattleShares locale={locale}
                byTier={distribution.byTier}
                byType={distribution.byType}
              />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {tierWinrate ? (
        <>
          <PanelSeparator />

          <TierWinratePanel grid={tierWinrate} region={region} />
        </>
      ) : null}

      <PanelSeparator />

      <Panel>
        <PanelContent className="text-sm text-fd-muted-foreground">
          <p>
            {/* The interval is in the sentence rather than a constant: it is
                about what the reader is looking at, not about the sampler's
                configuration. */}
            {t("we-record-it")}{" "}
            {stats.since
              ? t("series-starts", { at: formatMoment(stats.since, "UTC", locale) })
              : t("recording-just-started")}
          </p>
          <p className="mt-2">
            {t("wargaming-names-a-region-s")}</p>
        </PanelContent>
      </Panel>
    </div>
  );
}
