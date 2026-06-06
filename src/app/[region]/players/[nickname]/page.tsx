import type { Metadata } from "next";
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
import { PlayerStatsTable } from "@/components/players/stats-table";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
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

  const fullCache =
    initial.player &&
    initial.latestSnapshot &&
    initial.latestTankSnapshots.length > 0 &&
    initial.clanHistory;
  trace?.log(
    `cacheHit=${!!fullCache} hasPlayer=${!!initial.player} hasSnapshot=${!!initial.latestSnapshot} tanks=${initial.latestTankSnapshots.length} hasClanHistory=${!!initial.clanHistory}`,
  );

  if (fullCache) {
    return renderFromCache(
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

function renderFromCache(
  region: Region,
  accountId: number,
  initial: PlayerInitialData,
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>,
  wn8Expected: Awaited<ReturnType<typeof getWN8ExpectedValues>>,
  wnxExpected: Awaited<ReturnType<typeof getWNXExpectedValues>>,
): React.ReactElement {
  const player = initial.player as Player;
  const latest = initial.latestSnapshot as PlayerSnapshot;
  const tanks = tankSnapshotsToTankStats(initial.latestTankSnapshots);
  const clanHistory = initial.clanHistory!.data;

  // Coalesce: only re-enqueue if the last refresh was at least 5min ago.
  const ageMs = Date.now() - player.lastSeenAt.getTime();
  if (ageMs > REFRESH_COALESCE_MS) {
    enqueuePlayerRefreshBackground(region, [accountId], { priority: 10 });
  }

  return buildView({
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

  return buildView({
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

function buildView(args: {
  region: Region;
  player: Player;
  latest: PlayerSnapshot;
  tanks: TankStats[];
  clanHistory: PlayerClanHistoryFull;
  initial: PlayerInitialData;
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>;
  wn8Expected: Awaited<ReturnType<typeof getWN8ExpectedValues>>;
  wnxExpected: Awaited<ReturnType<typeof getWNXExpectedValues>>;
}): React.ReactElement {
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
          <PanelTitle>Overall stats</PanelTitle>
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

      <PlayerClansHistory
        region={region}
        accountCreatedAt={createdAt}
        clanHistory={clanHistory}
        nowMs={nowMs}
      />
    </div>
  );
}
