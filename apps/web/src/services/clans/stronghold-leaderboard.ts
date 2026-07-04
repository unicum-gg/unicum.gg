import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import {
  STRONGHOLD_MIN_BATTLES,
  StrongholdSort,
  StrongholdTier,
} from "@unicum.gg/core/constants/stronghold";
import { db } from "@unicum.gg/core/db";
import { clanSnapshotsByRegion, clansByRegion } from "@unicum.gg/core/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";

export type StrongholdLeaderboardEntry = {
  clanId: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  languages: string[];
  membersCount: number;
  elo: number | null;
  battles: number;
  battles30d: number | null;
  wins: number;
};

type RawEntry = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  languages: string[];
  members_count: number;
  elo: number | null;
  battles: number;
  battles_30d: number | null;
  wins: number;
};

function tierColumns(tier: StrongholdTier): {
  elo: string | null;
  battles: string;
  wins: string;
} {
  switch (tier) {
    case StrongholdTier.T10:
      return { elo: "elo_t10", battles: "skirmish_battles_t10", wins: "skirmish_wins_t10" };
    case StrongholdTier.T8:
      return { elo: "elo_t8", battles: "skirmish_battles_t8", wins: "skirmish_wins_t8" };
    case StrongholdTier.T6:
      return { elo: "elo_t6", battles: "skirmish_battles_t6", wins: "skirmish_wins_t6" };
    case StrongholdTier.Advances:
      // Advances (15v15) shares the Skirmish T10 ELO rating in WG's data.
      return { elo: "elo_t10", battles: "advances_battles_t10", wins: "advances_wins_t10" };
  }
}

function sortExpr(sort: StrongholdSort, cols: ReturnType<typeof tierColumns>): string {
  switch (sort) {
    case StrongholdSort.Elo:
      return cols.elo ? `${cols.elo} DESC NULLS LAST` : `${cols.battles} DESC NULLS LAST`;
    case StrongholdSort.Battles:
      return `${cols.battles} DESC NULLS LAST`;
    case StrongholdSort.Battles30d:
      return `battles_30d DESC NULLS LAST`;
    case StrongholdSort.Winrate:
      return `CASE WHEN ${cols.battles} > 0 THEN ${cols.wins}::float / ${cols.battles} ELSE NULL END DESC NULLS LAST`;
  }
}

async function fetchStrongholdLeaderboard(
  region: Region,
  tier: StrongholdTier,
  sort: StrongholdSort,
  limit: number,
): Promise<StrongholdLeaderboardEntry[]> {
  const snapshots = clanSnapshotsByRegion[region];
  const clans = clansByRegion[region];
  const cols = tierColumns(tier);

  const battlesCol = sql.raw(cols.battles);
  const winsCol = sql.raw(cols.wins);
  const eloCol = cols.elo ? sql.raw(cols.elo) : null;
  const sortRaw = sql.raw(sortExpr(sort, cols));
  const limitRaw = sql.raw(String(limit));
  const minBattlesRaw = sql.raw(String(STRONGHOLD_MIN_BATTLES[tier]));

  const rows = (await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (clan_id) *
      FROM ${snapshots}
      WHERE ${battlesCol} IS NOT NULL AND ${battlesCol} >= ${minBattlesRaw}
      ORDER BY clan_id, taken_at DESC
    ),
    baseline_30d AS (
      SELECT DISTINCT ON (clan_id) clan_id, ${battlesCol} AS battles
      FROM ${snapshots}
      WHERE taken_at <= now() - interval '30 days' AND ${battlesCol} IS NOT NULL
      ORDER BY clan_id, taken_at DESC
    )
    SELECT
      c.id AS clan_id,
      c.tag,
      c.name,
      c.color,
      COALESCE(c.emblem, '') AS emblem,
      c.languages,
      c.members_count,
      ${eloCol ? sql`latest.${eloCol} AS elo,` : sql`NULL::integer AS elo,`}
      latest.${battlesCol} AS battles,
      (latest.${battlesCol} - b30.battles) AS battles_30d,
      latest.${winsCol} AS wins
    FROM latest
    JOIN ${clans} c ON c.id = latest.clan_id
    LEFT JOIN baseline_30d b30 ON b30.clan_id = latest.clan_id
    WHERE c.is_disbanded = false
    ORDER BY ${sortRaw}
    LIMIT ${limitRaw}
  `)) as unknown as RawEntry[];

  return rows.map((r) => ({
    clanId: Number(r.clan_id),
    tag: r.tag,
    name: r.name,
    color: r.color,
    emblem: r.emblem,
    languages: r.languages ?? [],
    membersCount: Number(r.members_count),
    elo: r.elo === null ? null : Number(r.elo),
    battles: Number(r.battles),
    battles30d: r.battles_30d === null ? null : Number(r.battles_30d),
    wins: Number(r.wins),
  }));
}

export const getStrongholdLeaderboard = unstable_cache(
  fetchStrongholdLeaderboard,
  ["stronghold-leaderboard"],
  { revalidate: 600, tags: ["stronghold-leaderboard"] },
);
