import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { PlayerHeader } from "@/components/players/header";
import { modeFromQuery, sectionFromQuery } from "@/components/players/tabs";
import { PlayerTabsView } from "@/components/players/tabs-view";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getRatingMetricFromCookies } from "@/lib/rating-metric";
import { breadcrumbSchema, personSchema } from "@/lib/schema-org";
import { unicum } from "@/services/sdk";
import { UnicumError } from "@unicum.gg/sdk";
import {
  inferPlayerLanguages,
  RATING_METRIC_LABEL,
  type PlayerDetailData,
  type RatingMetric,
} from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// The page consumes its own public API through the SDK: the same
// `GET /{region}/players/{nickname}` payload the client refetches on LiveSync.
// The endpoint owns the stale-while-revalidate flow (cached data immediately;
// a cold cache resolves the account on WG, fetches live and records a
// snapshot). Next memoizes identical fetches within one render pass, so
// generateMetadata and the page body share a single request.
async function loadDetail(
  region: Region,
  nickname: string,
  metric: RatingMetric,
): Promise<PlayerDetailData | null> {
  try {
    const detail = await unicum
      .region(region)
      .players(nickname)
      .detail({ metric: metric as "wn7" | "wn8" | "wnx" });
    return detail as unknown as PlayerDetailData;
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; nickname: string }>;
}): Promise<Metadata> {
  const { region, nickname } = await params;
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(nickname);
  const metric = await getRatingMetricFromCookies();
  const detail = await loadDetail(region, decoded, metric).catch(() => null);
  const displayName = detail?.player.nickname ?? decoded;
  const regionLabel = region.toUpperCase();

  if (!detail || detail.current.battles === 0) {
    return constructMetadata({
      title: `${displayName} World of Tanks player stats (${regionLabel})`,
      description: `${displayName} (${regionLabel}) World of Tanks player stats: WN8, WNX ratings, winrate, tank-by-tank breakdown and full clan history.`,
      ogImage: false,
    });
  }

  const { current } = detail;
  const winrate = pctFmt.format((current.wins / current.battles) * 100);
  const battles = intFmt.format(current.battles);
  const rating = current.wtr ?? current.globalRating;
  return constructMetadata({
    title: `${displayName} World of Tanks stats (${regionLabel}), ${battles} battles, ${winrate}% WR`,
    description: `${displayName} on ${regionLabel}: ${battles} battles, ${winrate}% winrate, ${intFmt.format(rating)} rating. Tank-by-tank breakdown, WN8, WNX and full clans history.`,
    ogImage: false,
  });
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; nickname: string }>;
  searchParams: Promise<{ tab?: string; section?: string }>;
}) {
  const [{ region, nickname }, { tab: tabParam, section: sectionParam }] =
    await Promise.all([params, searchParams]);
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(nickname);
  // Two independent nav axes, each its own query param (see components/players/tabs).
  const section = sectionFromQuery(sectionParam);
  const mode = modeFromQuery(tabParam);

  const metric = await getRatingMetricFromCookies();
  const detail = await loadDetail(region, decoded, metric);
  if (!detail) notFound();

  const metricLabel = RATING_METRIC_LABEL[metric];
  const { current, clanHistory } = detail;
  const { accountId, createdAt, lastBattleAt, updatedAt } = detail.player;
  const displayName = detail.player.nickname;
  const nowMs = Date.now();

  const regionLabel = region.toUpperCase();
  const winrate =
    current.battles > 0 ? (current.wins / current.battles) * 100 : 0;
  const playerDescription =
    current.battles > 0
      ? `${displayName} (${regionLabel}) World of Tanks player stats: ${intFmt.format(current.battles)} battles, ${pctFmt.format(winrate)}% winrate, WN8 and WNX ratings, tank-by-tank breakdown and clan history.`
      : `${displayName} (${regionLabel}) World of Tanks player stats: WN8, WNX ratings, winrate, tank-by-tank breakdown and full clan history.`;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={personSchema({
          nickname: displayName,
          region: regionLabel,
          url: `${APP.URL}${ROUTES.PLAYER(region, displayName)}`,
          description: playerDescription,
          clanName: clanHistory.currentStint?.clan.name ?? null,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: `${APP.URL}${ROUTES.HOME(region)}` },
          { name: "Players", url: `${APP.URL}${ROUTES.PLAYERS(region)}` },
          {
            name: displayName,
            url: `${APP.URL}${ROUTES.PLAYER(region, displayName)}`,
          },
        ])}
      />
      <Panel>
        <PanelContent className="p-0">
          <PlayerHeader
            region={region}
            accountId={accountId}
            nickname={displayName}
            createdAt={createdAt}
            lastBattleAt={lastBattleAt}
            updatedAt={updatedAt}
            currentStint={clanHistory.currentStint}
            inferredLanguages={inferPlayerLanguages(clanHistory, nowMs)}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayerTabsView
        region={region}
        basePath={ROUTES.PLAYER(region, displayName)}
        nickname={displayName}
        activeSection={section}
        activeMode={mode}
        metricLabel={metricLabel}
        nowMs={nowMs}
        initialData={detail}
      />
    </div>
  );
}
