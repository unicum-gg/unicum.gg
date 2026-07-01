import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { LiveSync } from "@/components/live-sync";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerClansHistory } from "@/components/players/clans-history";
import { PlayerHeader } from "@/components/players/header";
import { PlayerRatingChart } from "@/components/players/rating-chart";
import { PlayerStatsTable } from "@/components/players/stats-table";
import { StrongholdStatsTable } from "@/components/players/stronghold-stats-table";
import { PlayerTab, PlayerTabsNav, tabFromQuery } from "@/components/players/tabs-nav";
import { TanksLiftDrag } from "@/components/players/tanks-lift-drag";
import { PlayerVehiclesTable } from "@/components/players/vehicles-table";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import {
  RATING_METRIC_LABEL,
  ratingMetricFromCookie,
} from "@/constants/rating";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { constructMetadata } from "@/lib/metadata";
import { styles } from "@/lib/styles";
import { PerfTrace, currentTrace, runWithTrace } from "@/lib/perf-trace";
import { personSchema } from "@/lib/schema-org";
import type { Player, PlayerSnapshot } from "@/services/db/schema";
import {
  cwAbsoluteStatsFromSnapshot,
  cwChampionStatsFromSnapshot,
  cwMiddleStatsFromSnapshot,
  diffStats,
  diffStrongholdStats,
  epicStatsFromSnapshot,
  falloutStatsFromSnapshot,
  fortifiedStatsFromSnapshot,
  rankedStatsFromSnapshot,
  recordCurrentSnapshot,
  skirmishStatsFromSnapshot,
  statsFromSnapshot,
} from "@/services/players";
import {
  loadPlayerClanHistoryFromWG,
  storePlayerClanHistory,
} from "@/services/players/clan-history";
import { inferPlayerLanguages } from "@/services/players/language-inference";
import {
  type PlayerInitialData,
  loadPlayerInitialData,
} from "@/services/players/initial-data";
import { getRatingHistory } from "@/services/players/rating-history";
import {
  diffTanks,
  tankSnapshotsToTankStats,
} from "@/services/players/tanks";
import { type Region, isRegion } from "@/services/wargaming/wot";
import {
  findPlayerByNickname,
  getAccountWTR,
  getPlayerInfo,
} from "@/services/wargaming/wot/accounts";
import type { PlayerClanHistoryFull } from "@/services/wargaming/wot/clans/player";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";
import { type TankStats, getTanksStats } from "@/services/wargaming/wot/tanks";

const EMPTY_CLAN_HISTORY: PlayerClanHistoryFull = {
  currentStint: null,
  pastStints: [],
  totalClans: 0,
  timeInClansSeconds: 0,
};

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
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ region, nickname }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(nickname);
  const activeTab = tabFromQuery(tabParam);

  const trace = new PerfTrace(`PlayerPage ${region}/${decoded}`);
  try {
    return await runWithTrace(trace, () => render(region, decoded, activeTab));
  } finally {
    trace.endRender();
  }
}

type Span = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

async function render(
  region: Region,
  decoded: string,
  activeTab: PlayerTab,
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

  // 3. Static data — cached at the service layer, cheap to await in series here.
  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    span("getVehicleEncyclopedia", () => getVehicleEncyclopedia(region)),
    span("getWN8ExpectedValues", () => getWN8ExpectedValues()),
    span("getWNXExpectedValues", () => getWNXExpectedValues()),
  ]);

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
    return await renderFromCache(
      region,
      accountId,
      initial,
      encyclopedia,
      wn8Expected,
      wnxExpected,
      activeTab,
    );
  }
  return await renderFromWG(
    region,
    accountId,
    initial,
    encyclopedia,
    wn8Expected,
    wnxExpected,
    span,
    activeTab,
  );
}

async function renderFromCache(
  region: Region,
  accountId: number,
  initial: PlayerInitialData,
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>,
  wn8Expected: Awaited<ReturnType<typeof getWN8ExpectedValues>>,
  wnxExpected: Awaited<ReturnType<typeof getWNXExpectedValues>>,
  activeTab: PlayerTab,
): Promise<React.ReactElement> {
  const player = initial.player as Player;
  const latest = initial.latestSnapshot as PlayerSnapshot;
  const tanks = tankSnapshotsToTankStats(initial.latestTankSnapshots);
  const clanHistory = initial.clanHistory?.data ?? EMPTY_CLAN_HISTORY;


  // If we rendered with a stub clan history, fire the real fetch in the
  // background. LiveSync's SSE will trigger router.refresh() once it's
  // stored and the next render will pick up the full data.
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
    encyclopedia,
    wn8Expected,
    wnxExpected,
    activeTab,
  });
}

async function renderFromWG(
  region: Region,
  accountId: number,
  initial: PlayerInitialData,
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>,
  wn8Expected: Awaited<ReturnType<typeof getWN8ExpectedValues>>,
  wnxExpected: Awaited<ReturnType<typeof getWNXExpectedValues>>,
  span: Span,
  activeTab: PlayerTab,
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
    encyclopedia,
    wn8Expected,
    wnxExpected,
    activeTab,
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
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>;
  wn8Expected: Awaited<ReturnType<typeof getWN8ExpectedValues>>;
  wnxExpected: Awaited<ReturnType<typeof getWNXExpectedValues>>;
  activeTab: PlayerTab;
}): Promise<React.ReactElement> {
  const {
    region,
    accountId,
    player,
    latest,
    tanks,
    clanHistory,
    initial,
    encyclopedia,
    wn8Expected,
    wnxExpected,
    activeTab,
  } = args;

  const current = statsFromSnapshot(latest);
  const periods = {
    h24: initial.periodSnapshots.h24
      ? diffStats(current, statsFromSnapshot(initial.periodSnapshots.h24))
      : null,
    d7: initial.periodSnapshots.d7
      ? diffStats(current, statsFromSnapshot(initial.periodSnapshots.d7))
      : null,
    d30: initial.periodSnapshots.d30
      ? diffStats(current, statsFromSnapshot(initial.periodSnapshots.d30))
      : null,
  };
  const periodTanks = {
    h24:
      initial.periodTankSnapshots.h24.size > 0
        ? diffTanks(tanks, initial.periodTankSnapshots.h24)
        : null,
    d7:
      initial.periodTankSnapshots.d7.size > 0
        ? diffTanks(tanks, initial.periodTankSnapshots.d7)
        : null,
    d30:
      initial.periodTankSnapshots.d30.size > 0
        ? diffTanks(tanks, initial.periodTankSnapshots.d30)
        : null,
  };

  const skirmishCurrent = skirmishStatsFromSnapshot(latest);
  const skirmishPeriods = {
    h24: skirmishCurrent && initial.periodSnapshots.h24
      ? (skirmishStatsFromSnapshot(initial.periodSnapshots.h24) !== null
          ? diffStrongholdStats(skirmishCurrent, skirmishStatsFromSnapshot(initial.periodSnapshots.h24)!)
          : null)
      : null,
    d7: skirmishCurrent && initial.periodSnapshots.d7
      ? (skirmishStatsFromSnapshot(initial.periodSnapshots.d7) !== null
          ? diffStrongholdStats(skirmishCurrent, skirmishStatsFromSnapshot(initial.periodSnapshots.d7)!)
          : null)
      : null,
    d30: skirmishCurrent && initial.periodSnapshots.d30
      ? (skirmishStatsFromSnapshot(initial.periodSnapshots.d30) !== null
          ? diffStrongholdStats(skirmishCurrent, skirmishStatsFromSnapshot(initial.periodSnapshots.d30)!)
          : null)
      : null,
  };

  const fortifiedCurrent = fortifiedStatsFromSnapshot(latest);
  const fortifiedPeriods = {
    h24: fortifiedCurrent && initial.periodSnapshots.h24
      ? (fortifiedStatsFromSnapshot(initial.periodSnapshots.h24) !== null
          ? diffStrongholdStats(fortifiedCurrent, fortifiedStatsFromSnapshot(initial.periodSnapshots.h24)!)
          : null)
      : null,
    d7: fortifiedCurrent && initial.periodSnapshots.d7
      ? (fortifiedStatsFromSnapshot(initial.periodSnapshots.d7) !== null
          ? diffStrongholdStats(fortifiedCurrent, fortifiedStatsFromSnapshot(initial.periodSnapshots.d7)!)
          : null)
      : null,
    d30: fortifiedCurrent && initial.periodSnapshots.d30
      ? (fortifiedStatsFromSnapshot(initial.periodSnapshots.d30) !== null
          ? diffStrongholdStats(fortifiedCurrent, fortifiedStatsFromSnapshot(initial.periodSnapshots.d30)!)
          : null)
      : null,
  };

  function makeStrongholdPeriods(
    current: ReturnType<typeof skirmishStatsFromSnapshot>,
    fromSnap: (s: typeof latest) => ReturnType<typeof skirmishStatsFromSnapshot>,
  ) {
    return {
      h24: current && initial.periodSnapshots.h24
        ? (fromSnap(initial.periodSnapshots.h24) !== null
            ? diffStrongholdStats(current, fromSnap(initial.periodSnapshots.h24)!)
            : null)
        : null,
      d7: current && initial.periodSnapshots.d7
        ? (fromSnap(initial.periodSnapshots.d7) !== null
            ? diffStrongholdStats(current, fromSnap(initial.periodSnapshots.d7)!)
            : null)
        : null,
      d30: current && initial.periodSnapshots.d30
        ? (fromSnap(initial.periodSnapshots.d30) !== null
            ? diffStrongholdStats(current, fromSnap(initial.periodSnapshots.d30)!)
            : null)
        : null,
    };
  }

  const epicCurrent = epicStatsFromSnapshot(latest);
  const epicPeriods = makeStrongholdPeriods(epicCurrent, epicStatsFromSnapshot);
  const falloutCurrent = falloutStatsFromSnapshot(latest);
  const falloutPeriods = makeStrongholdPeriods(falloutCurrent, falloutStatsFromSnapshot);
  const rankedCurrent = rankedStatsFromSnapshot(latest);
  const rankedPeriods = makeStrongholdPeriods(rankedCurrent, rankedStatsFromSnapshot);
  const cwAbsoluteCurrent = cwAbsoluteStatsFromSnapshot(latest);
  const cwAbsolutePeriods = makeStrongholdPeriods(cwAbsoluteCurrent, cwAbsoluteStatsFromSnapshot);
  const cwChampionCurrent = cwChampionStatsFromSnapshot(latest);
  const cwChampionPeriods = makeStrongholdPeriods(cwChampionCurrent, cwChampionStatsFromSnapshot);
  const cwMiddleCurrent = cwMiddleStatsFromSnapshot(latest);
  const cwMiddlePeriods = makeStrongholdPeriods(cwMiddleCurrent, cwMiddleStatsFromSnapshot);

  const createdAt = player.createdAt ?? new Date(0);
  const lastBattleAt = player.lastBattleAt ?? new Date(0);
  const nowMs = Date.now();

  const cookieStore = await cookies();
  const metric = ratingMetricFromCookie(
    cookieStore.get(STORAGE.COOKIES.RATING)?.value,
  );
  const metricLabel = RATING_METRIC_LABEL[metric];
  const ratingHistory = await getRatingHistory(region, player.id, metric);

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
      <LiveSync
        url={`/api/${region}/players/${encodeURIComponent(player.nickname)}/live`}
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

      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <PlayerTabsNav
            basePath={ROUTES.PLAYER(region, player.nickname)}
            activeTab={activeTab}
          />
        </PanelHeader>
      </Panel>

      {activeTab === PlayerTab.Overall ? (
        <>
          <PanelSeparator />

          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s random battles stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <PlayerStatsTable
                current={current}
                periods={periods}
                tanks={tanks}
                periodTanks={periodTanks}
                encyclopedia={encyclopedia}
                wn8Expected={wn8Expected}
                wnxExpected={wnxExpected}
              />
            </PanelContent>
          </Panel>

          <PanelSeparator />

          <Panel>
            <PanelHeader>
              <PanelTitle>
                {player.nickname}&apos;s {metricLabel} progression
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {ratingHistory.points.length > 0 ? (
                <>
                  <div className={`p-4 ${styles.mutedDescription}`}>
                    Solid line is overall {metricLabel} (matches the Total
                    column above), drifting slowly as new battles accumulate.
                    Dashed line is per-session {metricLabel}, computed from the
                    battles played since the previous snapshot. It shows hot
                    and cold streaks. Line color follows the rating tier.
                  </div>
                  <div className="px-4 pb-4">
                    <PlayerRatingChart
                      data={ratingHistory.points}
                      metricLabel={metricLabel}
                      metric={metric}
                    />
                  </div>
                </>
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  Not enough history yet. We need at least one snapshot to draw
                  the curve. Check back soon.
                </div>
              )}
            </PanelContent>
          </Panel>

          <PanelSeparator />

          <Panel>
            <PanelHeader>
              <PanelTitle>
                Tanks shaping {player.nickname}&apos;s rating
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <TanksLiftDrag
                region={region}
                tanks={tanks}
                encyclopedia={encyclopedia}
                wn8Expected={wn8Expected}
                wnxExpected={wnxExpected}
                metric={metric}
                metricLabel={metricLabel}
              />
            </PanelContent>
          </Panel>

          <PanelSeparator />

          <Panel>
            <PanelHeader>
              <PanelTitle>
                {player.nickname}&apos;s tanks (
                {intFmt.format(tanks.filter((t) => t.all.battles > 0).length)})
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <PlayerVehiclesTable
                region={region}
                tanks={tanks}
                encyclopedia={encyclopedia}
                wn8Expected={wn8Expected}
                wnxExpected={wnxExpected}
              />
            </PanelContent>
          </Panel>

          <PanelSeparator />

          <PlayerClansHistory
            region={region}
            nickname={player.nickname}
            accountCreatedAt={createdAt}
            clanHistory={clanHistory}
            nowMs={nowMs}
          />
        </>
      ) : activeTab === PlayerTab.Skirmish ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s skirmish stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {skirmishCurrent !== null ? (
                <StrongholdStatsTable current={skirmishCurrent} periods={skirmishPeriods} />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No skirmish data yet. Check back after the next snapshot.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      ) : activeTab === PlayerTab.Advances ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s advances stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {fortifiedCurrent !== null ? (
                <StrongholdStatsTable current={fortifiedCurrent} periods={fortifiedPeriods} />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No advances data yet. Check back after the next snapshot.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      ) : activeTab === PlayerTab.GrandBattles ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s grand battles stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {epicCurrent !== null ? (
                <StrongholdStatsTable current={epicCurrent} periods={epicPeriods} />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No grand battles data yet. Check back after the next snapshot.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      ) : activeTab === PlayerTab.RankedBattles ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s ranked battles stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {rankedCurrent !== null ? (
                <StrongholdStatsTable current={rankedCurrent} periods={rankedPeriods} />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No ranked battles data yet. Check back after the next snapshot.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      ) : activeTab === PlayerTab.ClanWarsX ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s Clan Wars Tier X stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {cwAbsoluteCurrent !== null ? (
                <StrongholdStatsTable current={cwAbsoluteCurrent} periods={cwAbsolutePeriods} />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No Clan Wars Tier X data yet. Check back after the next snapshot.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      ) : activeTab === PlayerTab.ClanWarsVIII ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s Clan Wars Tier VIII stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {cwChampionCurrent !== null ? (
                <StrongholdStatsTable current={cwChampionCurrent} periods={cwChampionPeriods} />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No Clan Wars Tier VIII data yet. Check back after the next snapshot.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      ) : activeTab === PlayerTab.ClanWarsVI ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s Clan Wars Tier VI stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {cwMiddleCurrent !== null ? (
                <StrongholdStatsTable current={cwMiddleCurrent} periods={cwMiddlePeriods} />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No Clan Wars Tier VI data yet. Check back after the next snapshot.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      ) : (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{player.nickname}&apos;s Steel Hunter stats</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              {falloutCurrent !== null ? (
                <StrongholdStatsTable current={falloutCurrent} periods={falloutPeriods} />
              ) : (
                <div className={`p-4 ${styles.mutedDescription}`}>
                  No Steel Hunter data yet. Check back after the next snapshot.
                </div>
              )}
            </PanelContent>
          </Panel>
        </>
      )}
    </div>
  );
}
