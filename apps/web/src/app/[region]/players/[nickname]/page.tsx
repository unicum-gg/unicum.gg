import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { PlayerHeader } from "@/components/players/header";
import {
  type PlayerMode,
  type PlayerSection,
  modeFromQuery,
  sectionFromQuery,
} from "@/components/players/tabs";
import { PlayerTabsView } from "@/components/players/tabs-view";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import { RATING_METRIC_LABEL, type Player, type PlayerSnapshot, type PlayerClanHistoryFull } from "@unicum.gg/shared";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getRatingMetricFromCookies } from "@/lib/rating-metric";
import { PerfTrace, currentTrace, runWithTrace } from "@unicum.gg/core/lib/perf-trace";
import { breadcrumbSchema, personSchema } from "@/lib/schema-org";
import { recordCurrentSnapshot } from "@unicum.gg/core/players";
import {
  loadPlayerClanHistoryFromWG,
  storePlayerClanHistory,
} from "@unicum.gg/core/players/clan-history";
import {
  buildPlayerDetail,
  EMPTY_CLAN_HISTORY,
} from "@unicum.gg/core/players/detail";
import { inferPlayerLanguages } from "@unicum.gg/core/players/language-inference";
import {
  type PlayerInitialData,
  loadPlayerInitialData,
} from "@unicum.gg/core/players/initial-data";
import { tankSnapshotsToTankStats } from "@unicum.gg/core/players/tanks";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import {
  findPlayerByNickname,
  getAccountWTR,
  getPlayerInfo,
} from "@unicum.gg/core/wargaming/wot/accounts";
import { type TankStats, getTanksStats } from "@unicum.gg/core/wargaming/wot/tanks";

const loadInitialByNickname = cache((region: Region, nickname: string) =>
  loadPlayerInitialData(region, { nickname }),
);

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; nickname: string }>;
}): Promise<Metadata> {
  const { region, nickname } = await params;
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(nickname);
  const initial = await loadInitialByNickname(region, decoded);
  const player = initial.player;
  const snap = initial.latestSnapshot;
  const displayName = player?.nickname ?? decoded;
  const regionLabel = region.toUpperCase();

  if (!snap || snap.battles === 0) {
    return constructMetadata({
      title: `${displayName} World of Tanks player stats (${regionLabel})`,
      description: `${displayName} (${regionLabel}) World of Tanks player stats: WN8, WNX ratings, winrate, tank-by-tank breakdown and full clan history.`,
      ogImage: false,
    });
  }

  const winrate = pctFmt.format((snap.wins / snap.battles) * 100);
  const battles = intFmt.format(snap.battles);
  const rating = snap.wtr ?? snap.globalRating;
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
  const active: ActiveTab = {
    section: sectionFromQuery(sectionParam),
    mode: modeFromQuery(tabParam),
  };

  const trace = new PerfTrace(`PlayerPage ${region}/${decoded}`);
  try {
    return await runWithTrace(trace, () => render(region, decoded, active));
  } finally {
    trace.endRender();
  }
}

type ActiveTab = { section: PlayerSection; mode: PlayerMode };
type Span = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

async function render(
  region: Region,
  decoded: string,
  active: ActiveTab,
): Promise<React.ReactElement> {
  const trace = currentTrace();
  const span: Span = (name, fn) => (trace ? trace.span(name, fn) : fn());

  // 1. Load whatever the DB has.
  let initial = await span("loadPlayerInitialData (by nickname)", () =>
    loadInitialByNickname(region, decoded),
  );

  // 2. Resolve accountId for true first-ever visits.
  let accountId = initial.player?.accountId ?? null;
  if (accountId === null) {
    const found = await span("findPlayerByNickname (WG)", () =>
      findPlayerByNickname(region, decoded),
    );
    if (!found) notFound();
    accountId = found.account_id;
    initial = await span("loadPlayerInitialData (by accountId)", () =>
      loadPlayerInitialData(region, { accountId: found.account_id }),
    );
  }

  // Stale-while-revalidate: if we have a player + at least one snapshot
  // we render the page right away. Missing tanks → stats table falls back
  // to "—". Missing clanHistory → empty section. Both get backfilled via
  // background WG fetches; LiveSync triggers `router.refresh()` when fresh
  // data lands. Avoids the 5-30s wait on WG when G-Core throttles EU,
  // even on long-tail accounts with 0 battles (e.g. fresh accounts whose
  // tank stats are empty by construction).
  const renderableFromCache =
    initial.player && initial.latestSnapshot;
  trace?.log(
    `cacheHit=${!!renderableFromCache} hasPlayer=${!!initial.player} hasSnapshot=${!!initial.latestSnapshot} tanks=${initial.latestTankSnapshots.length} hasClanHistory=${!!initial.clanHistory}`,
  );

  if (renderableFromCache) {
    return await renderFromCache(region, accountId, initial, active);
  }
  return await renderFromWG(region, accountId, initial, span, active);
}

async function renderFromCache(
  region: Region,
  accountId: number,
  initial: PlayerInitialData,
  active: ActiveTab,
): Promise<React.ReactElement> {
  const player = initial.player as Player;
  const latest = initial.latestSnapshot as PlayerSnapshot;
  const tanks = tankSnapshotsToTankStats(initial.latestTankSnapshots);
  const clanHistory = initial.clanHistory?.data ?? EMPTY_CLAN_HISTORY;

  // If we rendered with a stub clan history, fire the real fetch in the
  // background. LiveSync's SSE will trigger a refetch once it's stored and
  // the next render will pick up the full data.
  if (!initial.clanHistory) {
    void loadPlayerClanHistoryFromWG(region, accountId)
      .then((history) => storePlayerClanHistory(region, accountId, history))
      .catch((err) =>
        console.error("[bg] backfill clan history failed:", err),
      );
  }

  return await buildView({
    region,
    accountId,
    player,
    latest,
    tanks,
    clanHistory,
    initial,
    active,
  });
}

async function renderFromWG(
  region: Region,
  accountId: number,
  initial: PlayerInitialData,
  span: Span,
  active: ActiveTab,
): Promise<React.ReactElement> {
  const [info, fetchedTanks, fetchedWtr, fetchedClanHistory] = await Promise.all([
    span("getPlayerInfo", () => getPlayerInfo(region, accountId)),
    span("getTanksStats", () =>
      getTanksStats(region, accountId).catch((err) => {
        console.warn("[player page] getTanksStats failed:", err);
        return [] as TankStats[];
      }),
    ),
    span("getAccountWTR", () =>
      getAccountWTR(region, accountId).catch(() => null),
    ),
    span("loadPlayerClanHistoryFromWG", () =>
      loadPlayerClanHistoryFromWG(region, accountId).catch((err) => {
        console.error("[player page] loadPlayerClanHistoryFromWG failed:", err);
        return EMPTY_CLAN_HISTORY;
      }),
    ),
  ]);

  if (!info) notFound();

  const { player, latest } = await span("recordCurrentSnapshot", () =>
    recordCurrentSnapshot(region, info, fetchedWtr, fetchedTanks),
  );
  void storePlayerClanHistory(region, accountId, fetchedClanHistory).catch(
    (err) => console.error("[bg] storePlayerClanHistory failed:", err),
  );

  return await buildView({
    region,
    accountId,
    player,
    latest,
    tanks: fetchedTanks,
    clanHistory: fetchedClanHistory,
    initial,
    active,
  });
}

async function buildView(args: {
  region: Region;
  accountId: number;
  player: Player;
  latest: PlayerSnapshot;
  tanks: TankStats[];
  clanHistory: PlayerClanHistoryFull;
  initial: PlayerInitialData;
  active: ActiveTab;
}): Promise<React.ReactElement> {
  const { region, accountId, player, active } = args;

  const metric = await getRatingMetricFromCookies();
  const metricLabel = RATING_METRIC_LABEL[metric];

  // All page data (stats grid, vehicles, lift/drag, strongholds, rating
  // history) is assembled by the shared detail builder, the same payload the
  // player detail endpoint serves.
  const detail = await buildPlayerDetail({ ...args, metric });
  const { current, clanHistory } = detail;
  const { createdAt, lastBattleAt } = detail.player;
  const nowMs = Date.now();

  const regionLabel = region.toUpperCase();
  const winrate = current.battles > 0 ? (current.wins / current.battles) * 100 : 0;
  const playerDescription =
    current.battles > 0
      ? `${player.nickname} (${regionLabel}) World of Tanks player stats: ${intFmt.format(current.battles)} battles, ${pctFmt.format(winrate)}% winrate, WN8 and WNX ratings, tank-by-tank breakdown and clan history.`
      : `${player.nickname} (${regionLabel}) World of Tanks player stats: WN8, WNX ratings, winrate, tank-by-tank breakdown and full clan history.`;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={personSchema({
          nickname: player.nickname,
          region: regionLabel,
          url: `${APP.URL}${ROUTES.PLAYER(region, player.nickname)}`,
          description: playerDescription,
          clanName: clanHistory.currentStint?.clan.name ?? null,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: `${APP.URL}${ROUTES.HOME(region)}` },
          { name: "Players", url: `${APP.URL}${ROUTES.PLAYERS(region)}` },
          {
            name: player.nickname,
            url: `${APP.URL}${ROUTES.PLAYER(region, player.nickname)}`,
          },
        ])}
      />
      <Panel>
        <PanelContent className="p-0">
          <PlayerHeader
            region={region}
            accountId={accountId}
            nickname={player.nickname}
            createdAt={createdAt}
            lastBattleAt={lastBattleAt}
            updatedAt={player.lastSeenAt}
            currentStint={clanHistory.currentStint}
            inferredLanguages={inferPlayerLanguages(clanHistory, nowMs)}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayerTabsView
        region={region}
        basePath={ROUTES.PLAYER(region, player.nickname)}
        nickname={player.nickname}
        activeSection={active.section}
        activeMode={active.mode}
        metricLabel={metricLabel}
        nowMs={nowMs}
        initialData={detail}
      />
    </div>
  );
}
