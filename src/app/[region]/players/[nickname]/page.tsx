import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { LiveSync } from "@/components/live-sync";
import { PlayerClansHistory } from "@/components/players/clans-history";
import { PlayerHeader } from "@/components/players/header";
import { PlayerStatsTable } from "@/components/players/stats-table";
import { PerfTrace, currentTrace, runWithTrace } from "@/lib/perf-trace";
import { discoverClansBackground } from "@/services/discovery/clans";
import { loadPlayerInitialData } from "@/services/snapshots/player/initial-data";
import {
  storePlayerClanHistory,
} from "@/services/snapshots/player/clan-history";
import {
  diffStats,
  markPlayerSeen,
  recordCurrentSnapshot,
  statsFromSnapshot,
} from "@/services/snapshots/player";
import {
  diffTanks,
  tankSnapshotsToTankStats,
} from "@/services/snapshots/tank";
import {
  findPlayerByNickname,
  getAccountWTR,
  getPlayerInfo,
} from "@/services/wargaming/wot/accounts";
import { type Region, isRegion } from "@/services/wargaming/wot";
import { getFullPlayerClanHistory } from "@/services/wargaming/wot/clans/player";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";
import { getTanksStats } from "@/services/wargaming/wot/tanks";

const FRESH_MS = 30 * 60 * 1000;

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
    return {
      title: `${displayName} (${regionLabel}) — World of Tanks player stats — unicum.gg`,
      description: `World of Tanks player stats for ${displayName} on ${regionLabel}: WN8, WNX, winrate, tank progression and clans history.`,
    };
  }

  const winrate = pctFmt.format((snap.wins / snap.battles) * 100);
  const battles = intFmt.format(snap.battles);
  const rating = snap.wtr ?? snap.globalRating;
  return {
    title: `${displayName} (${regionLabel}) — ${battles} battles, ${winrate}% WR — World of Tanks stats — unicum.gg`,
    description: `${displayName} on ${regionLabel}: ${battles} battles, ${winrate}% winrate, ${intFmt.format(rating)} rating. Tank-by-tank breakdown, WN8, WNX and full clans history.`,
  };
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

async function render(
  region: Region,
  decoded: string,
): Promise<React.ReactElement> {
  const trace = currentTrace();
  const span = <T,>(name: string, fn: () => Promise<T>): Promise<T> =>
    trace ? trace.span(name, fn) : fn();

  let initial = await span("loadPlayerInitialData (by nickname)", () =>
    loadInitialByNickname(region, decoded),
  );
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
  const found = { account_id: accountId };
  const cachedPlayer = initial.player;
  const cachedSnapshot = initial.latestSnapshot;
  const cachedTankSnapshots = initial.latestTankSnapshots;
  const cachedClanHistory = initial.clanHistory;
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once at request time
  const nowMs = Date.now();

  const snapshotAgeMs = cachedSnapshot
    ? nowMs - cachedSnapshot.takenAt.getTime()
    : null;
  const snapshotFresh =
    !!cachedSnapshot &&
    cachedTankSnapshots.length > 0 &&
    !!cachedPlayer?.createdAt &&
    !!cachedPlayer?.lastBattleAt &&
    snapshotAgeMs !== null &&
    snapshotAgeMs < FRESH_MS;
  const clanHistoryFresh =
    !!cachedClanHistory &&
    nowMs - cachedClanHistory.fetchedAt.getTime() < FRESH_MS;
  trace?.log(
    `freshness snapshotFresh=${snapshotFresh} clanHistoryFresh=${clanHistoryFresh} cachedSnapshot=${!!cachedSnapshot} tanks=${cachedTankSnapshots.length} createdAt=${cachedPlayer?.createdAt?.toISOString() ?? "null"} lastBattleAt=${cachedPlayer?.lastBattleAt?.toISOString() ?? "null"} snapshotAgeMs=${snapshotAgeMs}`,
  );

  const [info, encyclopedia, wn8Expected, wnxExpected, fetchedTanks, fetchedWtr, fetchedClanHistory] =
    await Promise.all([
      snapshotFresh
        ? Promise.resolve(null)
        : span("getPlayerInfo", () =>
            getPlayerInfo(region, found.account_id).catch((err) => {
              console.warn(
                "[player page] getPlayerInfo failed, falling back to cache:",
                err,
              );
              return null;
            }),
          ),
      span("getVehicleEncyclopedia", () => getVehicleEncyclopedia(region)),
      span("getWN8ExpectedValues", () => getWN8ExpectedValues()),
      span("getWNXExpectedValues", () => getWNXExpectedValues()),
      snapshotFresh
        ? Promise.resolve(tankSnapshotsToTankStats(cachedTankSnapshots))
        : span("getTanksStats", () =>
            getTanksStats(region, found.account_id).catch((err) => {
              console.warn(
                "[player page] getTanksStats failed, falling back to cache:",
                err,
              );
              return tankSnapshotsToTankStats(cachedTankSnapshots);
            }),
          ),
      snapshotFresh
        ? Promise.resolve(cachedSnapshot.wtr)
        : span("getAccountWTR", () =>
            getAccountWTR(region, found.account_id).catch((err) => {
              console.warn(
                "[player page] getAccountWTR failed, falling back to cache:",
                err,
              );
              return cachedSnapshot?.wtr ?? null;
            }),
          ),
      clanHistoryFresh
        ? Promise.resolve(cachedClanHistory.data)
        : span("getFullPlayerClanHistory", () =>
            getFullPlayerClanHistory(region, found.account_id).catch((err) => {
              console.error(
                "[player page] getFullPlayerClanHistory failed, falling back:",
                err,
              );
              return (
                cachedClanHistory?.data ?? {
                  currentStint: null,
                  pastStints: [],
                  totalClans: 0,
                  timeInClansSeconds: 0,
                }
              );
            }),
          ),
    ]);

  const tanks = fetchedTanks;
  const wtr = fetchedWtr;

  let player = cachedPlayer;
  let latest = cachedSnapshot;
  if (!snapshotFresh && info) {
    const battlesChanged =
      !cachedSnapshot || info.statistics.all.battles !== cachedSnapshot.battles;
    trace?.log(`battlesChanged=${battlesChanged}`);
    if (battlesChanged) {
      const cachedTankMap = new Map(
        cachedTankSnapshots.map((t) => [t.tankId, t.battles]),
      );
      const changedTanks = tanks.filter((t) => {
        const prev = cachedTankMap.get(t.tank_id);
        return prev === undefined || prev !== t.all.battles;
      });
      trace?.log(
        `tank diff: ${changedTanks.length}/${tanks.length} changed`,
      );
      const result = await span("recordCurrentSnapshot", () =>
        recordCurrentSnapshot(region, info, wtr, changedTanks),
      );
      player = result.player;
      latest = result.latest;
    } else if (cachedPlayer) {
      // Battles unchanged: detach the lastSeenAt update so it doesn't block render
      void markPlayerSeen(region, info).catch((err) =>
        console.error("[bg] markPlayerSeen failed:", err),
      );
    }
  } else if (!snapshotFresh && !info) {
    trace?.log(
      "wg refresh unavailable, rendering from cached DB snapshot if any",
    );
  }
  if (!player || !latest) notFound();

  const clanHistory = fetchedClanHistory;
  if (!clanHistoryFresh) {
    void storePlayerClanHistory(region, found.account_id, clanHistory).catch(
      (err) => console.error("[bg] storePlayerClanHistory failed:", err),
    );
  }

  // Discovery: every clan seen in the history is a candidate for our DB
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
    h24: initial.periodTankSnapshots.h24.size > 0
      ? diffTanks(tanks, initial.periodTankSnapshots.h24)
      : null,
    d7: initial.periodTankSnapshots.d7.size > 0
      ? diffTanks(tanks, initial.periodTankSnapshots.d7)
      : null,
    d30: initial.periodTankSnapshots.d30.size > 0
      ? diffTanks(tanks, initial.periodTankSnapshots.d30)
      : null,
  };

  const createdAt = player.createdAt ?? new Date((info?.created_at ?? 0) * 1000);
  const lastBattleAt =
    player.lastBattleAt ?? new Date((info?.last_battle_time ?? 0) * 1000);

  return (
    <div className="mx-auto w-full max-w-7xl">
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

