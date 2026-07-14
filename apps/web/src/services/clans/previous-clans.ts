import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@unicum.gg/core/db";
import {
  clanMembersByRegion,
  clansByRegion,
  playerClanHistoryByRegion,
} from "@unicum.gg/core/db/schema";
import { type Region } from "@unicum.gg/wargaming";

export type PreviousClanRow = {
  clanId: number;
  tag: string;
  name: string;
  color: string;
  emblem: string | null;
  languages: string[];
  totalCount: number;
  cameFromCount: number;
};

async function getPreviousClansUncached(
  region: Region,
  clanId: number,
  limit: number,
): Promise<PreviousClanRow[]> {
  const clanMembers = clanMembersByRegion[region];
  const playerClanHistory = playerClanHistoryByRegion[region];
  const clans = clansByRegion[region];

  // For each CURRENT member of the target clan, walk their `pastStints`
  // JSONB array, count distinct past clans (totalCount), and find each
  // member's most-recent past stint to compute cameFromCount (= "joined
  // directly from this clan"). Past stints in the target clan itself are
  // excluded — a member who left and re-joined would otherwise show the
  // current clan in its own list. Disbanded clans are kept (informative).
  const rows = (await db.execute(sql`
    WITH current_members AS (
      SELECT cm.account_id
      FROM ${clanMembers} cm
      WHERE cm.clan_id = ${clanId}
    ),
    past_stints AS (
      SELECT
        cm.account_id,
        (s->'clan'->>'id')::bigint AS past_clan_id,
        NULLIF(s->>'leftAt', '')::timestamptz AS left_at
      FROM current_members cm
      INNER JOIN ${playerClanHistory} pch USING (account_id)
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(pch.data->'pastStints', '[]'::jsonb)
      ) s
      WHERE s->'clan'->>'id' IS NOT NULL
        AND (s->'clan'->>'id')::bigint != ${clanId}
    ),
    most_recent_past AS (
      SELECT DISTINCT ON (account_id)
        account_id,
        past_clan_id
      FROM past_stints
      ORDER BY account_id, left_at DESC NULLS LAST
    ),
    totals AS (
      SELECT past_clan_id AS clan_id,
        COUNT(DISTINCT account_id)::int AS total_count
      FROM past_stints
      GROUP BY past_clan_id
    ),
    came_from AS (
      SELECT past_clan_id AS clan_id,
        COUNT(*)::int AS came_from_count
      FROM most_recent_past
      GROUP BY past_clan_id
    )
    SELECT
      c.id::text AS clan_id,
      c.tag,
      c.name,
      c.color,
      c.emblem,
      c.languages,
      t.total_count,
      COALESCE(cf.came_from_count, 0)::int AS came_from_count
    FROM totals t
    INNER JOIN ${clans} c ON c.id = t.clan_id
    LEFT JOIN came_from cf ON cf.clan_id = t.clan_id
    ORDER BY t.total_count DESC, came_from_count DESC, c.tag ASC
    LIMIT ${limit}
  `)) as unknown as Array<{
    clan_id: string;
    tag: string;
    name: string;
    color: string;
    emblem: string | null;
    languages: string[] | null;
    total_count: number;
    came_from_count: number;
  }>;

  return rows.map((r) => ({
    clanId: Number(r.clan_id),
    tag: r.tag,
    name: r.name,
    color: r.color,
    emblem: r.emblem,
    languages: r.languages ?? [],
    totalCount: r.total_count,
    cameFromCount: r.came_from_count,
  }));
}

const getPreviousClansCached = unstable_cache(
  getPreviousClansUncached,
  ["previous-clans"],
  // Member rosters change slowly (hourly cron + on-demand refresh), and
  // clan-history blobs update on player-page visits or via the snapshot
  // pipeline. 5 minutes is well under the data's actual mutation rate
  // while still amortizing the JSONB lateral-unnest across page hits.
  { revalidate: 300, tags: ["clan-members"] },
);

export function getPreviousClans(
  region: Region,
  clanId: number,
  limit: number = 10,
): Promise<PreviousClanRow[]> {
  return getPreviousClansCached(region, clanId, limit);
}
