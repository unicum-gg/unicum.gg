import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  EMPTY_TANK_OVERALL,
  buildPlayerTankDetail,
  buildPlayerTankModeRecords,
  playersByRegion,
  tankModeBlocks,
  tankSnapshotsByRegion,
  type PlayerTankRecord,
  type TankStats,
} from "@unicum.gg/shared";
import type { Region, WgLanguage } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getRatingHistory } from "@unicum.gg/core/players/rating-history";
import { getTankAwards } from "@unicum.gg/core/players/tank-achievements";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getTankModeRows } from "@unicum.gg/core/players/tank-modes";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";

type RawRow = {
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

/** A snapshot row as the record builders read it. */
function snapshotTank(tankId: number, row: RawRow): TankStats {
  return {
    tank_id: tankId,
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
}

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
 * the player has never taken it into a battle of any mode.
 */
export async function getPlayerTankDetail(
  region: Region,
  nickname: string,
  slug: string,
  /** Names the medals in the reader's language; see `getCatalog`. */
  language?: WgLanguage,
): Promise<PlayerTankRecord | null> {
  const identity = await getTankBySlug(region, slug);
  if (!identity) return null;

  const players = playersByRegion[region];
  const snapshots = tankSnapshotsByRegion[region];
  const [player] = (await db.execute(sql`
    SELECT id AS pid, account_id AS acct
    FROM ${players}
    WHERE LOWER(nickname) = LOWER(${nickname})
    LIMIT 1
  `)) as unknown as { pid: number; acct: number }[];
  if (!player) return null;

  const rows = (await db.execute(sql`
    SELECT *
    FROM ${snapshots}
    WHERE player_id = ${player.pid}
      AND tank_id = ${identity.tankId}
    ORDER BY taken_at DESC, battles DESC
    LIMIT 1
  `)) as unknown as RawRow[];

  // A vehicle only ever taken into a mode outside `all` (the tier XI Skirmish
  // fleet is the whole of it) has no snapshot, since Wargaming reports it with
  // nothing in `all`. Its record is still real and lives in its mode rows, so
  // an absent snapshot is an empty overall block rather than an unknown vehicle.
  const row: RawRow | undefined = rows[0];
  const tank: TankStats = row
    ? snapshotTank(identity.tankId, row)
    : { tank_id: identity.tankId, mark_of_mastery: null, all: { ...EMPTY_TANK_OVERALL } };

  const [encyclopedia, wn8Expected, wnxExpected, history, awards, modeRows] =
    await Promise.all([
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
      // The same two curves the profile draws, narrowed to this vehicle. Same
      // window as the profile's, so the two read as one story.
      getRatingHistory(region, Number(player.pid), 90, identity.tankId),
      // Read here rather than fetched by the panel, so the medals are part of
      // the server-rendered record instead of a second round trip that arrives
      // after it.
      getTankAwards(
        region,
        Number(player.pid),
        Number(player.acct),
        identity.tankId,
        language,
      ).catch((err) => {
        // The record is worth serving without its medals; the reverse is not
        // true, so a Wargaming or catalogue failure must not 502 the panel.
        console.error(`[tank-detail] awards failed (${region}/${slug}):`, err);
        return null;
      }),
      // Where those battles were fought. A read of its own rather than columns
      // on the snapshot above, because a vehicle has between zero and ten of
      // these and the primary key's own prefix goes straight to them.
      getTankModeRows(region, Number(player.pid), identity.tankId).catch((err) => {
        // Same trade as the medals: the record is worth serving without its
        // breakdown, and the reverse is not true.
        console.error(`[tank-detail] modes failed (${region}/${slug}):`, err);
        return [];
      }),
    ]);

  const blocks = tankModeBlocks(
    tank.all,
    { maxXp: tank.max_xp ?? null, maxFrags: tank.max_frags ?? null },
    modeRows,
  );
  // With nothing in `all`, the record's own figures come from the first mode
  // the vehicle was played in, which is also the block the panel falls back
  // to when the vehicle holds no Random record. No snapshot and no mode row
  // is a vehicle never taken into a battle.
  const first = row ? null : blocks[0];
  if (!row && !first) return null;
  const takenAt = row
    ? new Date(row.taken_at)
    : (modeRows.reduce<Date | null>(
        (latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest),
        null,
      ) ?? new Date());
  const detail = buildPlayerTankDetail(
    first ? { ...tank, all: first.stats } : tank,
    identity.meta,
    identity.slug,
    takenAt,
    encyclopedia,
    wn8Expected,
    wnxExpected,
  );
  if (!detail) return null;
  return {
    ...detail,
    ratingHistory: history.points,
    awards,
    // Random comes out of the snapshot and the two other parts of `all` rather
    // than out of a row of its own. See `deriveRandomBlock`.
    modes: buildPlayerTankModeRecords(
      identity.tankId,
      blocks,
      identity.meta?.tier ?? null,
      encyclopedia,
      wn8Expected,
      wnxExpected,
    ),
  };
}
