import { RatingMetric, buildPlayerDerivedStats, type PeriodStats, type PlayerDerivedStats, buildLiftDrag, type LiftDrag, buildPlayerTankRows, type PlayerTankRow, type Player, type PlayerSnapshot, type PlayerClanHistoryFull, EMPTY_CLAN_HISTORY, type PlayerDetailData, type StrongholdModeData } from "@unicum.gg/shared";
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
  type Stats,
  type StrongholdStats,
} from "@unicum.gg/core/players";
import { getAccountSubscription, isActiveStatus } from "@unicum.gg/core/subscription";
import { getAccountTwitchLogin, isAccountVerified } from "@unicum.gg/core/players/badges";
import {
  findAccountIdByFormerNickname,
  getPlayerNameHistory,
} from "@unicum.gg/core/players/name-history";
import {
  type PlayerInitialData,
  loadPlayerInitialData,
} from "@unicum.gg/core/players/initial-data";
import {
  getRatingHistory,
  type RatingHistoryPoint,
} from "@unicum.gg/core/players/rating-history";
import { diffTanks, tankSnapshotsToTankStats } from "@unicum.gg/core/players/tanks";
import {
  loadPlayerClanHistoryFromWG,
  storePlayerClanHistory,
} from "@unicum.gg/core/players/clan-history";
import {
  findPlayerByNickname,
  getAccountWTR,
  getPlayerInfo,
} from "@unicum.gg/core/wargaming/wot/accounts";
import { getTanksStats } from "@unicum.gg/core/wargaming/wot/tanks";
import type { Region } from "@unicum.gg/wargaming";
import { countEarnedAchievements } from "@unicum.gg/core/players/achievements";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getAllTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import { computePlayerValuation, type TankEconomics } from "@unicum.gg/shared";

// The client-safe shapes (`PlayerDetailData`, the stronghold-mode types) and
// the pure `EMPTY_CLAN_HISTORY` const live in `@unicum.gg/shared/players/detail`;
// re-exported here for back-compat. This module keeps the server-side builders.
export * from "@unicum.gg/shared/players/detail";

/**
 * Assembles the player detail from already-resolved inputs. Shared by the
 * player page SSR (which resolves them via its stale-while-revalidate flow,
 * falling back to live WG fetches on a cold DB) and by `loadPlayerDetail`
 * below (DB-only path for the API), so both produce the exact same payload.
 */
export async function buildPlayerDetail(args: {
  region: Region;
  accountId: number;
  player: Player;
  latest: PlayerSnapshot;
  tanks: TankStats[];
  clanHistory: PlayerClanHistoryFull;
  initial: PlayerInitialData;
}): Promise<PlayerDetailData> {
  const { region, accountId, player, latest, tanks, clanHistory, initial } =
    args;

  const [
    encyclopedia,
    wn8Expected,
    wnxExpected,
    ratingHistory,
    specs,
    supporterSub,
    nameHistory,
    isVerified,
    twitchLogin,
    achievementCount,
  ] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getRatingHistory(region, player.id),
    getAllTankSpecs(),
    getAccountSubscription(region, accountId),
    getPlayerNameHistory(region, accountId),
    isAccountVerified(region, accountId),
    getAccountTwitchLogin(region, accountId),
    // Distinct medals earned, for the "Achievements (N)" tab label. Reads the
    // denormalised column rather than counting the jsonb map, so it is a
    // primary-key lookup on a table with one row per player, and it rides in
    // the parallel batch the detail already makes.
    countEarnedAchievements(region, player.id),
  ]);
  // Public supporter badge: active, and not opted out via podium anonymity.
  const isSupporter = supporterSub
    ? isActiveStatus(supporterSub.status) && !supporterSub.anonymous
    : false;
  // Lite economics map for the vehicle rows' account-value fields.
  const economics = new Map<number, TankEconomics>();
  for (const [tankId, s] of specs) {
    economics.set(tankId, {
      buyGold: s.buyGold,
      buyCredits: s.buyCredits,
      researchXp: s.researchXp,
    });
  }

  const current = statsFromSnapshot(latest);
  // Account-stat diff for a period. An empty first fetch (battles === 0, the
  // poisoned snapshot where WG's aggregate lagged) means the whole period is
  // "everything since we started tracking" = the lifetime total, so return
  // `current`. This keeps the rating-delta rows honest too: the poisoned
  // baseline carried a non-zero wtr (e.g. 8313) even with battles 0, so a naive
  // diff showed a partial change (wtr 10072 - 8313 = +1759) instead of the real
  // +10072. Legit players have battles > 0 at first fetch, so this only fires on
  // the artifact.
  function periodDiff(baseline: PlayerSnapshot | null): typeof current | null {
    if (!baseline) return null;
    if (baseline.battles === 0) return current;
    return diffStats(current, statsFromSnapshot(baseline));
  }
  const periods: PeriodStats = {
    h24: periodDiff(initial.periodSnapshots.h24),
    d7: periodDiff(initial.periodSnapshots.d7),
    d30: periodDiff(initial.periodSnapshots.d30),
  };
  // Per-tank diff for a period. When the account baseline is an *empty* first
  // fetch (battles === 0 — a poisoned snapshot where WG's `statistics.all`
  // aggregate lagged the per-tank data at first sight), the account rows already
  // read as the lifetime total (subtracting zero), but the per-tank baseline
  // caught a battle or two, so a naive tank diff would drop them and make the
  // derived stats (combined dmg, WN8, WNX) disagree with the account rows for the
  // same column. Treat such a period as "= lifetime" for the tanks too (return
  // the full `tanks`), keeping the column internally consistent. Legit players
  // always have battles > 0 at first fetch, so this only fires on that artifact.
  function periodTankDiff(
    baseline: PlayerSnapshot | null,
    baselineTanks: (typeof initial.periodTankSnapshots)["d30"],
  ): typeof tanks | null {
    if (!baseline) return null;
    if (baseline.battles === 0) return tanks;
    return baselineTanks.size > 0 ? diffTanks(tanks, baselineTanks) : null;
  }
  const periodTanks = {
    h24: periodTankDiff(
      initial.periodSnapshots.h24,
      initial.periodTankSnapshots.h24,
    ),
    d7: periodTankDiff(
      initial.periodSnapshots.d7,
      initial.periodTankSnapshots.d7,
    ),
    d30: periodTankDiff(
      initial.periodSnapshots.d30,
      initial.periodTankSnapshots.d30,
    ),
  };

  function mode(
    fromSnap: (s: PlayerSnapshot) => StrongholdStats | null,
  ): StrongholdModeData {
    const current = fromSnap(latest);
    function diffFor(snap: PlayerSnapshot | null): StrongholdStats | null {
      if (!current || !snap) return null;
      const past = fromSnap(snap);
      return past !== null ? diffStrongholdStats(current, past) : null;
    }
    return {
      current,
      periods: {
        h24: diffFor(initial.periodSnapshots.h24),
        d7: diffFor(initial.periodSnapshots.d7),
        d30: diffFor(initial.periodSnapshots.d30),
      },
    };
  }

  const derived = buildPlayerDerivedStats(
    current,
    periods,
    tanks,
    periodTanks,
    encyclopedia,
    wn8Expected,
    wnxExpected,
  );
  const vehicles = buildPlayerTankRows(
    tanks,
    encyclopedia,
    wn8Expected,
    wnxExpected,
    economics,
  );

  return {
    player: {
      accountId,
      nickname: player.nickname,
      createdAt: player.createdAt ?? new Date(0),
      lastBattleAt: player.lastBattleAt ?? new Date(0),
      updatedAt: player.lastSeenAt,
    },
    nameHistory,
    isSupporter,
    isVerified,
    twitchLogin,
    current,
    periods,
    derived,
    tankCount: vehicles.length,
    achievementCount,
    valuation: computePlayerValuation(
      vehicles,
      current.globalRating,
      current.battles,
      region,
    ),
    liftDrag: {
      wn7: buildLiftDrag(tanks, encyclopedia, wn8Expected, wnxExpected, RatingMetric.Wn7),
      wn8: buildLiftDrag(tanks, encyclopedia, wn8Expected, wnxExpected, RatingMetric.Wn8),
      wnx: buildLiftDrag(tanks, encyclopedia, wn8Expected, wnxExpected, RatingMetric.Wnx),
    },
    ratingHistory: ratingHistory.points,
    clanHistory,
    strongholds: {
      skirmish: mode(skirmishStatsFromSnapshot),
      fortified: mode(fortifiedStatsFromSnapshot),
      epic: mode(epicStatsFromSnapshot),
      ranked: mode(rankedStatsFromSnapshot),
      fallout: mode(falloutStatsFromSnapshot),
      cwAbsolute: mode(cwAbsoluteStatsFromSnapshot),
      cwChampion: mode(cwChampionStatsFromSnapshot),
      cwMiddle: mode(cwMiddleStatsFromSnapshot),
    },
  };
}

/**
 * DB-only loader for the player detail endpoint: serves whatever the tracker
 * has cached and never falls back to live WG fetches (page hits enqueue
 * refreshes; the API just reads). Returns null when the player is unknown or
 * has no snapshot yet.
 */
export async function loadPlayerDetail(
  region: Region,
  nickname: string,
): Promise<PlayerDetailData | null> {
  const initial = await loadPlayerInitialData(region, { nickname });
  if (!initial.player || !initial.latestSnapshot) return null;
  return buildPlayerDetail({
    region,
    accountId: initial.player.accountId,
    player: initial.player,
    latest: initial.latestSnapshot,
    tanks: tankSnapshotsToTankStats(initial.latestTankSnapshots),
    clanHistory: initial.clanHistory?.data ?? EMPTY_CLAN_HISTORY,
    initial,
  });
}

/**
 * Loader for the on-demand per-tank list endpoint (the heavy `vehicles` array
 * that used to ride along in the detail payload). Resolves the player from the
 * DB, loads the latest per-tank snapshots and builds the rows the exact same way
 * `buildPlayerDetail` does. DB-only (no live WG fetch): the detail endpoint
 * already resolves/records cold accounts, so by the time the Tanks section is
 * opened the player is tracked. Returns null when the player is unknown.
 */
export async function loadPlayerTanks(
  region: Region,
  nickname: string,
): Promise<PlayerTankRow[] | null> {
  const initial = await loadPlayerInitialData(region, { nickname });
  if (!initial.player) return null;

  const tanks = tankSnapshotsToTankStats(initial.latestTankSnapshots);
  const [encyclopedia, wn8Expected, wnxExpected, specs] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getAllTankSpecs(),
  ]);
  const economics = new Map<number, TankEconomics>();
  for (const [tankId, s] of specs) {
    economics.set(tankId, {
      buyGold: s.buyGold,
      buyCredits: s.buyCredits,
      researchXp: s.researchXp,
    });
  }
  return buildPlayerTankRows(
    tanks,
    encyclopedia,
    wn8Expected,
    wnxExpected,
    economics,
  );
}

export enum PlayerDetailLiveStatus {
  /** Full detail payload available. */
  Found = "found",
  /** WG resolves the nickname but the account is locked (info is null). */
  Locked = "locked",
  /** WG doesn't know the nickname on this region. */
  Unknown = "unknown",
}

export type PlayerDetailLiveResult =
  | { status: PlayerDetailLiveStatus.Found; detail: PlayerDetailData }
  | {
      status: PlayerDetailLiveStatus.Locked;
      accountId: number;
      nickname: string;
    }
  | { status: PlayerDetailLiveStatus.Unknown };

/**
 * Stale-while-revalidate loader for the player detail endpoint (the flow the
 * player page used to run inline). DB first: a player with at least one
 * snapshot renders immediately from cache (a missing clan history backfills in
 * the background and LiveSync refetches when it lands). On a cold DB, resolve the
 * account on WG, fetch live, and record a snapshot, which also starts tracking
 * the player. `Locked` when WG resolves the nickname but returns no account
 * data (an account locked by Wargaming), `Unknown` when WG doesn't know the
 * nickname either.
 */
export async function loadPlayerDetailLive(
  region: Region,
  nickname: string,
): Promise<PlayerDetailLiveResult> {
  let initial = await loadPlayerInitialData(region, { nickname });

  // Resolve accountId for true first-ever visits.
  let accountId = initial.player?.accountId ?? null;
  let resolvedNickname = initial.player?.nickname ?? null;

  if (accountId === null) {
    const found = await findPlayerByNickname(region, nickname).catch(() => null);
    if (found) {
      accountId = found.account_id;
      resolvedNickname = found.nickname;
      initial = await loadPlayerInitialData(region, { accountId });
    }
  }

  // Nobody carries this nickname today, so look for who used to: WG only knows
  // current names, and a link to a since-renamed player would 404 here.
  //
  // Deliberately last. Asking WG first is what keeps a *reclaimed* nickname
  // pointing at its new owner even when that player is not in our database yet
  // — resolving the history before WG would have sent visitors to the previous
  // owner instead. It costs no extra WG call, since an unresolved nickname
  // already went through `account/list` above.
  //
  // The caller compares the returned `nickname` with the one it was given to
  // decide whether to redirect.
  if (accountId === null) {
    const formerOwner = await findAccountIdByFormerNickname(
      region,
      nickname,
    ).catch(() => null);
    if (formerOwner === null) return { status: PlayerDetailLiveStatus.Unknown };
    const byAccount = await loadPlayerInitialData(region, {
      accountId: formerOwner,
    });
    if (!byAccount.player) return { status: PlayerDetailLiveStatus.Unknown };
    initial = byAccount;
    accountId = byAccount.player.accountId;
    resolvedNickname = byAccount.player.nickname;
  }

  if (initial.player && initial.latestSnapshot) {
    // Cache hit. A stub clan history backfills in the background; LiveSync's
    // SSE triggers a refetch once it is stored.
    if (!initial.clanHistory) {
      void loadPlayerClanHistoryFromWG(region, accountId)
        .then((history) => storePlayerClanHistory(region, accountId!, history))
        .catch((err) =>
          console.error("[bg] backfill clan history failed:", err),
        );
    }
    return {
      status: PlayerDetailLiveStatus.Found,
      detail: await buildPlayerDetail({
        region,
        accountId,
        player: initial.player,
        latest: initial.latestSnapshot,
        tanks: tankSnapshotsToTankStats(initial.latestTankSnapshots),
        clanHistory: initial.clanHistory?.data ?? EMPTY_CLAN_HISTORY,
        initial,
      }),
    };
  }

  // Cold DB: fetch everything live from WG and record a snapshot (which also
  // starts tracking the player). Account info comes first and gates the rest:
  // WG's account/list can resolve a nickname whose account/info is null
  // (wiped/deleted account), and the other fetches are expensive to run for
  // nothing (the portal clan history retries through a 1 RPS limiter, which
  // once stretched this 404 to minutes).
  const info = await getPlayerInfo(region, accountId);
  if (!info) {
    return {
      status: PlayerDetailLiveStatus.Locked,
      accountId,
      nickname: resolvedNickname ?? nickname,
    };
  }
  const [fetchedTanks, fetchedWtr, fetchedClanHistory] = await Promise.all([
    getTanksStats(region, accountId).catch((err) => {
      console.warn("[player detail] getTanksStats failed:", err);
      return [] as TankStats[];
    }),
    getAccountWTR(region, accountId).catch(() => null),
    loadPlayerClanHistoryFromWG(region, accountId).catch((err) => {
      console.error("[player detail] loadPlayerClanHistoryFromWG failed:", err);
      return EMPTY_CLAN_HISTORY;
    }),
  ]);

  const { player, latest } = await recordCurrentSnapshot(
    region,
    info,
    fetchedWtr,
    fetchedTanks,
  );
  void storePlayerClanHistory(region, accountId, fetchedClanHistory).catch(
    (err) => console.error("[bg] storePlayerClanHistory failed:", err),
  );

  return {
    status: PlayerDetailLiveStatus.Found,
    detail: await buildPlayerDetail({
      region,
      accountId,
      player,
      latest,
      tanks: fetchedTanks,
      clanHistory: fetchedClanHistory,
      initial,
    }),
  };
}
