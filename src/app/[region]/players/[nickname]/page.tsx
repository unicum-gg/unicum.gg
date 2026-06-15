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
import { discoverClansBackground } from "@/services/discovery/clans";
import {
  diffStats,
  recordCurrentSnapshot,
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
import { enqueuePlayerRefreshBackground } from "@/services/players/refresh-queue";
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

const REFRESH_COALESCE_MS = 5 * 60 * 1000;

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
}: {
  params: Promise<{ region: string; nickname: string }>;
}) {
  const { region, nickname } = await params;
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(nickname);

  const trace = new PerfTrace(`PlayerPage ${region}/${decoded}`);
  try {
    return await runWithTrace(trace, () => render(region, decoded));
  } finally {
    trace.endRender();
  }
}

type Span = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

async function render(
  region: Region,
  decoded: string,
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
  );
}

async function renderFromCache(
  region: Region,
  accountId: number,
  initial: PlayerInitialData,
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>,
  wn8Expected: Awaited<ReturnType<typeof getWN8ExpectedValues>>,
  wnxExpected: Awaited<ReturnType<typeof getWNXExpectedValues>>,
): Promise<React.ReactElement> {
  const player = initial.player as Player;
  const latest = initial.latestSnapshot as PlayerSnapshot;
  const tanks = tankSnapshotsToTankStats(initial.latestTankSnapshots);
  const clanHistory = initial.clanHistory?.data ?? EMPTY_CLAN_HISTORY;

  // Coalesce: only re-enqueue if the last refresh was at least 5min ago.
  const ageMs = Date.now() - player.lastSeenAt.getTime();
  if (ageMs > REFRESH_COALESCE_MS) {
    enqueuePlayerRefreshBackground(region, [accountId], { priority: 10 });
  }

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
    player,
    latest,
    tanks,
    clanHistory,
    initial,
    encyclopedia,
    wn8Expected,
    wnxExpected,
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
    player,
    latest,
    tanks: fetchedTanks,
    clanHistory: fetchedClanHistory,
    initial,
    encyclopedia,
    wn8Expected,
    wnxExpected,
  });
}

async function buildView(args: {
  region: Region;
  player: Player;
  latest: PlayerSnapshot;
  tanks: TankStats[];
  clanHistory: PlayerClanHistoryFull;
  initial: PlayerInitialData;
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>;
  wn8Expected: Awaited<ReturnType<typeof getWN8ExpectedValues>>;
  wnxExpected: Awaited<ReturnType<typeof getWNXExpectedValues>>;
}): Promise<React.ReactElement> {
  const {
    region,
    player,
    latest,
    tanks,
    clanHistory,
    initial,
    encyclopedia,
    wn8Expected,
    wnxExpected,
  } = args;

  // Discovery: every clan seen in the history is a candidate for our DB.
  const clanIdsSeen: number[] = [];
  if (clanHistory.currentStint) clanIdsSeen.push(clanHistory.currentStint.clan.id);
  for (const s of clanHistory.pastStints) clanIdsSeen.push(s.clan.id);
  discoverClansBackground(region, clanIdsSeen);

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
        <PanelHeader>
          <PanelTitle>{player.nickname}&apos;s overall stats</PanelTitle>
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
            {player.nickname}&apos;s vehicles (
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
    </div>
  );
}
