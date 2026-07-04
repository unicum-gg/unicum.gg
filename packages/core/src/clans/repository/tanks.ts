import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  clanMembersByRegion,
  playersByRegion,
  tankSnapshotsByRegion,
} from "@unicum.gg/core/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";

export type ClanTankAggregate = {
  tankId: number;
  memberCount: number;
  battles: number;
  wins: number;
  damageDealt: number;
  frags: number;
  spotted: number;
  droppedCapturePoints: number;
  radioAssistedDamage: number;
  trackAssistedDamage: number;
  xp: number;
};

type RawRow = {
  tank_id: number;
  member_count: number;
  battles: string;
  wins: string;
  damage_dealt: string;
  frags: string;
  spotted: string;
  dropped_capture_points: string;
  radio_assisted_damage: string;
  track_assisted_damage: string;
  xp: string;
};

/**
 * For each tank that at least one member of the clan has played, aggregate
 * stats across all members using their most recent tank snapshot (latest
 * battles count). Returns rows sorted by total battles desc.
 *
 * The `DISTINCT ON (player_id, tank_id)` ensures we only consider one row
 * per (member, tank) pair, taking the most recent snapshot. Then we sum and
 * count across members per tank_id.
 */
export async function getClanTankAggregates(
  region: Region,
  clanId: number,
): Promise<ClanTankAggregate[]> {
  const players = playersByRegion[region];
  const clanMembers = clanMembersByRegion[region];
  const tankSnapshots = tankSnapshotsByRegion[region];

  const rows = (await db.execute(sql`
    WITH member_player_ids AS (
      SELECT p.id
      FROM ${clanMembers} cm
      INNER JOIN ${players} p ON p.account_id = cm.account_id
      WHERE cm.clan_id = ${clanId}
    ),
    latest_per_member_tank AS (
      SELECT DISTINCT ON (player_id, tank_id)
        player_id, tank_id, battles, wins, damage_dealt, frags, spotted,
        dropped_capture_points, radio_assisted_damage, track_assisted_damage,
        COALESCE(xp, 0) AS xp
      FROM ${tankSnapshots}
      WHERE player_id IN (SELECT id FROM member_player_ids)
        AND battles > 0
      ORDER BY player_id, tank_id, taken_at DESC, id DESC
    )
    SELECT
      tank_id,
      COUNT(DISTINCT player_id)::int AS member_count,
      SUM(battles)::text AS battles,
      SUM(wins)::text AS wins,
      SUM(damage_dealt)::text AS damage_dealt,
      SUM(frags)::text AS frags,
      SUM(spotted)::text AS spotted,
      SUM(dropped_capture_points)::text AS dropped_capture_points,
      SUM(radio_assisted_damage)::text AS radio_assisted_damage,
      SUM(track_assisted_damage)::text AS track_assisted_damage,
      SUM(xp)::text AS xp
    FROM latest_per_member_tank
    GROUP BY tank_id
    ORDER BY SUM(battles) DESC
  `)) as unknown as RawRow[];

  return rows.map((r) => ({
    tankId: r.tank_id,
    memberCount: r.member_count,
    battles: Number(r.battles),
    wins: Number(r.wins),
    damageDealt: Number(r.damage_dealt),
    frags: Number(r.frags),
    spotted: Number(r.spotted),
    droppedCapturePoints: Number(r.dropped_capture_points),
    radioAssistedDamage: Number(r.radio_assisted_damage),
    trackAssistedDamage: Number(r.track_assisted_damage),
    xp: Number(r.xp),
  }));
}
