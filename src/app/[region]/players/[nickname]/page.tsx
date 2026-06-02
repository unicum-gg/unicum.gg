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
import { enqueuePlayerRefreshBackground } from "@/services/refresh-queue";
import { loadPlayerInitialData } from "@/services/snapshots/player/initial-data";
import {
  diffStats,
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

  // First-ever visit (nothing in our DB for this nickname): synchronously
  // resolve via WG, persist a snapshot, then proceed as a normal render.
  // Every subsequent visit serves from the DB and refreshes in background.
  if (!initial.player || !initial.latestSnapshot) {
    const found = await span("findPlayerByNickname (WG)", () =>
      findPlayerByNickname(region, decoded),
    );
    if (!found) notFound();
    const [info, tanks, wtr] = await Promise.all([
      span("getPlayerInfo", () => getPlayerInfo(region, found.account_id)),
      span("getTanksStats", () => getTanksStats(region, found.account_id)),
      span("getAccountWTR", () =>
        getAccountWTR(region, found.account_id).catch(() => null),
      ),
    ]);
    if (!info) notFound();
    await span("recordCurrentSnapshot", () =>
      recordCurrentSnapshot(region, info, wtr, tanks),
    );
    initial = await span("loadPlayerInitialData (by accountId, post-bootstrap)", () =>
      loadPlayerInitialData(region, { accountId: found.account_id }),
    );
  }

  const player = initial.player;
  const latest = initial.latestSnapshot;
  if (!player || !latest) notFound();

  const cachedTankSnapshots = initial.latestTankSnapshots;
  const cachedClanHistory = initial.clanHistory;
  const nowMs = Date.now();

  const snapshotAgeMs = nowMs - latest.takenAt.getTime();
  const snapshotStale =
    snapshotAgeMs > FRESH_MS ||
    cachedTankSnapshots.length === 0 ||
    !player.createdAt ||
    !player.lastBattleAt;
  const clanHistoryStale =
    !cachedClanHistory ||
    nowMs - cachedClanHistory.fetchedAt.getTime() > FRESH_MS;
  trace?.log(
    `freshness snapshotStale=${snapshotStale} clanHistoryStale=${clanHistoryStale} snapshotAgeMs=${snapshotAgeMs} tanks=${cachedTankSnapshots.length}`,
  );

  // Stale data: kick off a background refresh via the queue (user priority).
  // Cron drains it within ~1 minute; the next page hit serves the fresh data.
  if (snapshotStale || clanHistoryStale) {
    enqueuePlayerRefreshBackground(region, [player.accountId], {
      priority: 10,
    });
  }

  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    span("getVehicleEncyclopedia", () => getVehicleEncyclopedia(region)),
    span("getWN8ExpectedValues", () => getWN8ExpectedValues()),
    span("getWNXExpectedValues", () => getWNXExpectedValues()),
  ]);

  const tanks = tankSnapshotsToTankStats(cachedTankSnapshots);
  const clanHistory =
    cachedClanHistory?.data ?? {
      currentStint: null,
      pastStints: [],
      totalClans: 0,
      timeInClansSeconds: 0,
    };

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

  // First-visit bootstrap above always persists createdAt and lastBattleAt,
  // so subsequent renders read them from the DB. Old records pre-dating that
  // field may still be missing them — fall back to epoch and let the
  // background refresh fill them in shortly.
  const createdAt = player.createdAt ?? new Date(0);
  const lastBattleAt = player.lastBattleAt ?? new Date(0);

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

