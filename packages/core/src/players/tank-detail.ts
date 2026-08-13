import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  buildPlayerTankDetail,
  playersByRegion,
  tankSnapshotsByRegion,
  type PlayerTankRecord,
  type TankStats,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getRatingHistory } from "@unicum.gg/core/players/rating-history";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";

type RawRow = {
  pid: number;
  taken_at: string | Date;
  battles: number;
  wins: number;
  damage_dealt: number;
  spotted: number;
  frags: number;
  dropped_capture_points: number;
  radio_assisted_damage: number;
  track_assisted_damage: number;
  xp: number | null;
  mark_of_mastery: number | null;
  marks_on_gun: number | null;
  survived_battles: number | null;
  hits: number | null;
  shots: number | null;
  damage_blocked: number | null;
  damage_received: number | null;
  capture_points: number | null;
  stun_number: number | null;
  stun_assisted_damage: number | null;
  tanking_factor: number | null;
  max_xp: number | null;
  max_frags: number | null;
};

const num = (v: number | null): number | undefined =>
  v == null ? undefined : Number(v);

/**
 * One player's record on one vehicle.
 *
 * Reads a single row: the newest snapshot for that (player, tank), which the
 * `(player_id, taken_at)` index takes straight to. The player page's own tank
 * list cannot serve this, because it deliberately drops the columns behind the
 * damage ratio and the stuns (it only needs the rating inputs, over every tank
 * a player owns), and re-reading one row is cheaper than widening that path.
 *
 * Returns null when the player is unknown to us, the slug is not a vehicle, or
 * the player has never taken it into a battle.
 */
export async function getPlayerTankDetail(
  region: Region,
  nickname: string,
  slug: string,
): Promise<PlayerTankRecord | null> {
  const identity = await getTankBySlug(region, slug);
  if (!identity) return null;

  const players = playersByRegion[region];
  const snapshots = tankSnapshotsByRegion[region];
  const rows = (await db.execute(sql`
    SELECT *, (SELECT id FROM ${players} WHERE LOWER(nickname) = LOWER(${nickname})) AS pid
    FROM ${snapshots}
    WHERE player_id = (
      SELECT id FROM ${players} WHERE LOWER(nickname) = LOWER(${nickname})
    )
      AND tank_id = ${identity.tankId}
    ORDER BY taken_at DESC, battles DESC
    LIMIT 1
  `)) as unknown as RawRow[];

  const row = rows[0];
  if (!row) return null;

  const tank: TankStats = {
    tank_id: identity.tankId,
    mark_of_mastery: num(row.mark_of_mastery) ?? null,
    marks_on_gun: num(row.marks_on_gun) ?? null,
    max_xp: num(row.max_xp),
    max_frags: num(row.max_frags),
    all: {
      battles: Number(row.battles),
      wins: Number(row.wins),
      damage_dealt: Number(row.damage_dealt),
      spotted: Number(row.spotted),
      frags: Number(row.frags),
      dropped_capture_points: Number(row.dropped_capture_points),
      radio_assisted_damage: Number(row.radio_assisted_damage),
      track_assisted_damage: Number(row.track_assisted_damage),
      xp: num(row.xp) ?? 0,
      survived_battles: num(row.survived_battles),
      hits: num(row.hits),
      shots: num(row.shots),
      // Stored cumulative, and the builder wants the average back: this is the
      // one counter WG reports per battle rather than as a total.
      avg_damage_blocked:
        row.damage_blocked == null
          ? undefined
          : Number(row.damage_blocked) / Number(row.battles),
      damage_received: num(row.damage_received),
      capture_points: num(row.capture_points),
      stun_number: num(row.stun_number),
      stun_assisted_damage: num(row.stun_assisted_damage),
      tanking_factor: num(row.tanking_factor),
    },
  };

  const [encyclopedia, wn8Expected, wnxExpected, history] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    // The same two curves the profile draws, narrowed to this vehicle. Same
    // window as the profile's, so the two read as one story.
    getRatingHistory(region, Number(row.pid), 90, identity.tankId),
  ]);

  const detail = buildPlayerTankDetail(
    tank,
    identity.meta,
    identity.slug,
    row.taken_at instanceof Date ? row.taken_at : new Date(row.taken_at),
    encyclopedia,
    wn8Expected,
    wnxExpected,
  );
  return detail && { ...detail, ratingHistory: history.points };
}
