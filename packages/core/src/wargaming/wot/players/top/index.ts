import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import {
  RatingMetric,
  StrongholdPeriod,
  TOP_PLAYERS_MIN_BATTLES,
  clansByRegion,
  playersByRegion,
  topPlayersByRegion,
  type PlayerBadgeFlags,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";
import { TopPlayersPeriod } from "./period";

export { TopPlayersPeriod } from "./period";

// The two enums carry the same wire values; shared names the floors so the
// page can state the one of the board it shows.
const MIN_BATTLES = TOP_PLAYERS_MIN_BATTLES as Record<
  TopPlayersPeriod | StrongholdPeriod,
  number
>;

/** How far back each recent window reaches, for the inactivity guard. */
export const PERIOD_WINDOW: Record<Exclude<TopPlayersPeriod, TopPlayersPeriod.Overall>, string> = {
  [TopPlayersPeriod.Day]: "24 hours",
  [TopPlayersPeriod.Week]: "7 days",
  [TopPlayersPeriod.Month]: "30 days",
};

/**
 * Clan tag and colour for a set of accounts, read from our own tables.
 *
 * This went to Wargaming's `clans/accountinfo` while a board held thirty rows,
 * which was harmless. At a thousand rows a window it is thirty batched calls
 * per period per region every hour against a budget the page views need, for
 * data the players table already links: `clan_id` is what the overall board on
 * /players has always joined on, so both boards now name the same clan.
 */
async function clansFromDb(
  region: Region,
  accountIds: number[],
): Promise<Map<number, { tag: string; color: string }>> {
  const out = new Map<number, { tag: string; color: string }>();
  if (accountIds.length === 0) return out;
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const rows = await db
    .select({ accountId: players.accountId, tag: clans.tag, color: clans.color })
    .from(players)
    .innerJoin(clans, eq(clans.id, players.clanId))
    .where(inArray(players.accountId, accountIds));
  for (const r of rows) out.set(Number(r.accountId), { tag: r.tag, color: r.color });
  return out;
}

async function attachClans(region: Region, out: TopPlayersAllMetrics) {
  const uniqueIds = new Set<number>();
  for (const list of Object.values(out)) {
    for (const r of list) uniqueIds.add(r.account_id);
  }
  const clansByAccount = await clansFromDb(region, [...uniqueIds]);
  for (const list of Object.values(out)) {
    for (const r of list) {
      const clan = clansByAccount.get(r.account_id);
      if (clan) {
        r.clan_tag = clan.tag;
        r.clan_color = clan.color;
      }
    }
  }
}

export type TopPlayerResult = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  /** Win rate (0-1) over the board's window. Only the stored boards carry it. */
  winrate?: number | null;
  wnx: number;
} & PlayerBadgeFlags;

export type TopPlayersAllMetrics = {
  [RatingMetric.Wn7]: TopPlayerResult[];
  [RatingMetric.Wn8]: TopPlayerResult[];
  [RatingMetric.Wnx]: TopPlayerResult[];
};

export async function computeTopPlayersAllMetrics(
  region: Region,
  period: TopPlayersPeriod,
  limit: number,
): Promise<TopPlayersAllMetrics> {
  // Overall ratings are already cached on the players row by snapshot-cron,
  // so the lifetime ranking is just a SELECT + ORDER BY on each column. No
  // need to scan tens of millions of tank_snapshots and recompute.
  if (period === TopPlayersPeriod.Overall) {
    return computeOverallFromCache(region, limit);
  }

  const ratings = await computePlayerPeriodRatings(
    region,
    period,
    MIN_BATTLES[period],
  );
  if (ratings.length === 0) {
    return {
      [RatingMetric.Wn7]: [],
      [RatingMetric.Wn8]: [],
      [RatingMetric.Wnx]: [],
    };
  }

  function topByScore(field: "wn7" | "wn8" | "wnx"): TopPlayerResult[] {
    return ratings
      .filter(
        (s): s is PlayerPeriodRating & { [K in typeof field]: number } =>
          s[field] !== null,
      )
      .sort((a, b) => b[field] - a[field])
      .slice(0, limit)
      .map((s) => ({
        account_id: s.account_id,
        nickname: s.nickname,
        clan_tag: null,
        clan_color: null,
        battles: s.battles,
        wnx: s[field],
      }));
  }

  const out: TopPlayersAllMetrics = {
    [RatingMetric.Wn7]: topByScore("wn7"),
    [RatingMetric.Wn8]: topByScore("wn8"),
    [RatingMetric.Wnx]: topByScore("wnx"),
  };
  await attachClans(region, out);
  return out;
}

/**
 * Per-player period ratings for every active player in a region, WITHOUT the
 * top-N slicing or clan enrichment. Shared by the player leaderboard (which
 * then ranks + enriches per metric) and the clan leaderboard (which aggregates
 * these per-member scores into a clan-level battle-weighted average). The
 * `minBattles` floor gates who counts as "active" over the period: the player
 * leaderboard passes its per-period minimum, the clan aggregation a lower floor
 * so more members contribute (their weight is their period battle count).
 */
export type PlayerPeriodRating = {
  account_id: number;
  nickname: string;
  battles: number;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

export async function computePlayerPeriodRatings(
  region: Region,
  period: TopPlayersPeriod,
  minBattles: number,
): Promise<PlayerPeriodRating[]> {
  const players = playersByRegion[region];
  // The snapshot pipeline keeps a cached recent-window rating per period on the
  // players row (see players/index.ts updatePlayerRatings), in lockstep with
  // every snapshot. So this is a single indexed read of the ~2M-row players
  // table instead of a DISTINCT-ON seq scan + on-disk sort over the 300M-row
  // tank_snapshots table every hour — the same idea the Overall fast path uses.
  // The window is relative to each player's last snapshot rather than exactly
  // now, but leaderboard players are active (re-snapshotted within hours), so it
  // tracks closely and self-corrects on their next snapshot.
  const byPeriod = {
    [TopPlayersPeriod.Day]: {
      battles: players.battles24h,
      wn7: players.wn724h,
      wn8: players.wn824h,
      wnx: players.wnx24h,
    },
    [TopPlayersPeriod.Week]: {
      battles: players.battles7d,
      wn7: players.wn77d,
      wn8: players.wn87d,
      wnx: players.wnx7d,
    },
    [TopPlayersPeriod.Month]: {
      battles: players.battles30d,
      wn7: players.wn730d,
      wn8: players.wn830d,
      wnx: players.wnx30d,
    },
    [TopPlayersPeriod.Overall]: null,
  };
  const cols = byPeriod[period];
  if (!cols) {
    throw new Error(
      `computePlayerPeriodRatings: unexpected period ${period}`,
    );
  }

  const rows = await db
    .select({
      account_id: players.accountId,
      nickname: players.nickname,
      battles: cols.battles,
      wn7: cols.wn7,
      wn8: cols.wn8,
      wnx: cols.wnx,
    })
    .from(players)
    .where(
      and(
        gte(cols.battles, minBattles),
        // The window columns are only rewritten when the account moves, so a
        // player who stopped keeps the window of their last battle forever.
        // Without this an account idle since spring still ranks on "the past
        // 7 days" it played in April.
        gte(
          players.lastBattleAt,
          sql`now() - ${sql.raw(`interval '${PERIOD_WINDOW[period as keyof typeof PERIOD_WINDOW]}'`)}`,
        ),
      ),
    );

  return rows.map((r) => ({
    account_id: Number(r.account_id),
    nickname: r.nickname,
    battles: r.battles ?? 0,
    wn7: r.wn7,
    wn8: r.wn8,
    wnx: r.wnx,
  }));
}

/**
 * Overall ranking fast path: the players row holds the cached lifetime
 * wn7/wn8/wnx (refreshed by snapshot-cron) plus `battles`. So the lifetime
 * top N is a single typed Drizzle query per metric, no raw SQL, no
 * DISTINCT-ON scan of any snapshot table.
 */
async function computeOverallFromCache(
  region: Region,
  limit: number,
): Promise<TopPlayersAllMetrics> {
  const minBattles = MIN_BATTLES[TopPlayersPeriod.Overall];
  const players = playersByRegion[region];

  const fetchTop = async (
    column: typeof players.wn7 | typeof players.wn8 | typeof players.wnx,
  ): Promise<TopPlayerResult[]> => {
    const rows = await db
      .select({
        accountId: players.accountId,
        nickname: players.nickname,
        battles: players.battles,
        value: column,
      })
      .from(players)
      .where(and(gte(players.battles, minBattles), isNotNull(column)))
      .orderBy(desc(column))
      .limit(limit);
    return rows.map((r) => ({
      account_id: Number(r.accountId),
      nickname: r.nickname,
      clan_tag: null,
      clan_color: null,
      battles: r.battles ?? 0,
      wnx: Number(r.value),
    }));
  };

  const [wn7, wn8, wnx] = await Promise.all([
    fetchTop(players.wn7),
    fetchTop(players.wn8),
    fetchTop(players.wnx),
  ]);

  const out: TopPlayersAllMetrics = {
    [RatingMetric.Wn7]: wn7,
    [RatingMetric.Wn8]: wn8,
    [RatingMetric.Wnx]: wnx,
  };
  await attachClans(region, out);
  return out;
}

/**
 * The win rate over the board's own window (0-1), read off the players row at
 * request time rather than stored on the board: the wins are counted by the
 * same pass that counts the window's battles, so the two agree, and a lifetime
 * win rate beside a 7-day rating would be answering a different question.
 */
function winrateFor(
  players: (typeof playersByRegion)[Region],
  period: TopPlayersPeriod,
) {
  switch (period) {
    case TopPlayersPeriod.Day:
      return sql<number | null>`${players.wins24h}::real / NULLIF(${players.battles24h}, 0)`;
    case TopPlayersPeriod.Week:
      return sql<number | null>`${players.wins7d}::real / NULLIF(${players.battles7d}, 0)`;
    case TopPlayersPeriod.Month:
      return sql<number | null>`${players.wins30d}::real / NULLIF(${players.battles30d}, 0)`;
    case TopPlayersPeriod.Overall:
      return sql<number | null>`${players.winrate}`;
  }
}

export type TopPlayersSnapshot = {
  results: TopPlayerResult[];
  computedAt: Date | null;
};

export async function getTopPlayersByMetric(
  region: Region,
  metric: string,
  period: TopPlayersPeriod,
  limit: number,
): Promise<TopPlayersSnapshot> {
  const topPlayers = topPlayersByRegion[region];
  const players = playersByRegion[region];
  const rows = await db
    .select({
      accountId: topPlayers.accountId,
      nickname: topPlayers.nickname,
      clanTag: topPlayers.clanTag,
      clanColor: topPlayers.clanColor,
      battles: topPlayers.battles,
      value: topPlayers.value,
      computedAt: topPlayers.computedAt,
      winrate: winrateFor(players, period),
    })
    .from(topPlayers)
    .leftJoin(players, eq(players.accountId, topPlayers.accountId))
    .where(
      and(eq(topPlayers.metric, metric), eq(topPlayers.period, period)),
    )
    .orderBy(asc(topPlayers.rank))
    .limit(limit);

  return {
    results: rows.map((r) => ({
      account_id: r.accountId,
      nickname: r.nickname,
      clan_tag: r.clanTag,
      clan_color: r.clanColor,
      battles: r.battles,
      winrate: r.winrate == null ? null : Number(r.winrate),
      wnx: Number(r.value),
    })),
    computedAt: rows[0]?.computedAt ?? null,
  };
}

export async function getTopPlayersByMetricByRegions(
  regions: Region[],
  metric: string,
  period: TopPlayersPeriod,
  limit: number,
): Promise<Record<Region, TopPlayersSnapshot>> {
  const perRegion = await Promise.all(
    regions.map(
      async (region) =>
        [
          region,
          await getTopPlayersByMetric(region, metric, period, limit),
        ] as const,
    ),
  );
  const out = {} as Record<Region, TopPlayersSnapshot>;
  for (const [region, snap] of perRegion) out[region] = snap;
  return out;
}
