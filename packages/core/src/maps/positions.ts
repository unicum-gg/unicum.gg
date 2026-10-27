import { and, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import {
  battleHitsByRegion,
  battlesByRegion,
  battleSpotsByRegion,
  loadoutModeOf,
  positionAt,
  projectPoint,
  readMotion,
  readReplay,
  replayClockOffset,
  replayStartFromMovement,
  settleSpot,
  vehiclesByRegion,
  type BattleVehicle,
  type MapPoint,
  type NewBattleHitRow,
  type NewBattleSpotRow,
  type ReplayContainer,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { fetchReplay } from "@unicum.gg/core/battles/replays";
import { minimapsByArena } from "@unicum.gg/core/wargaming/wot/maps";
import { drawing } from "@unicum.gg/core/battles/read";

/**
 * Turning one archived replay into where its players set up and where they
 * dealt damage from (see `battle_spots` and `battle_hits`).
 *
 * Done when the file arrives, like the loadouts beside it, and for the same
 * reason: the decode is a decryption and an inflate over a megabyte, and its
 * answer never changes. The backfill below does the same for the replays
 * archived before this existed.
 */

/** Why a replay yielded no rows, for the backfill's report. */
export enum PositionSkip {
  /** The battle is not in the database, or not in a counted mode. */
  NoBattle = "no_battle",
  /** The recording has no packet stream: an unfinished battle. */
  NoStream = "no_stream",
  /** Nobody in the header is somebody in the battle's results. */
  NoRecorder = "no_recorder",
  /** No arena box to project onto. */
  NoBox = "no_box",
  /**
   * Nothing pins the recording's clock to the battle's: nobody survived to the
   * end of the recording and no team mate was ever seen moving. Without the
   * start, the opening cannot be told from the countdown.
   */
  NoClock = "no_clock",
}

export type PositionWrite =
  | { spots: number; hits: number }
  | { skipped: PositionSkip };

/** Read the replay and write its spots and hits. */
export async function storePositionsFromReplay(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
  bytes: Uint8Array,
): Promise<PositionWrite> {
  return storePositionsFromContainer(
    region,
    arenaUniqueId,
    startedAt,
    await readReplay(bytes),
  );
}

/**
 * Write a battle's spots and hits out of a replay already read.
 *
 * Separate from the above so the upload route reads the file once for the
 * loadouts and this together.
 *
 * Replaces whatever the battle held, in one transaction, so a re-read after a
 * change to how positions are read rewrites the battle instead of leaving the
 * old rows beside the new ones.
 */
export async function storePositionsFromContainer(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
  container: ReplayContainer,
): Promise<PositionWrite> {
  if (container.stream.length === 0) return { skipped: PositionSkip.NoStream };

  const battles = battlesByRegion[region];
  const [battle] = await db
    .select({
      mapName: battles.mapName,
      battleType: battles.battleType,
      gameplayId: battles.gameplayId,
      winnerTeam: battles.winnerTeam,
      vehicles: battles.vehicles,
    })
    .from(battles)
    .where(
      and(
        eq(battles.startedAt, startedAt),
        eq(battles.arenaUniqueId, arenaUniqueId),
      ),
    )
    .limit(1);
  if (!battle || !loadoutModeOf(battle.battleType)) {
    return { skipped: PositionSkip.NoBattle };
  }

  const gameplayId = battle.gameplayId ?? "ctf";
  const box = drawing(
    (await minimapsByArena(region)).get(battle.mapName),
    gameplayId,
  ).mapBounds;
  if (!box) return { skipped: PositionSkip.NoBox };

  const built = positionRowsOf(
    container,
    battle,
    box,
    await vehicleClasses(
      region,
      battle.vehicles.map((vehicle) => vehicle.tank),
    ),
  );
  if ("skipped" in built) return built;

  const stamp = {
    arenaUniqueId,
    startedAt,
    mapName: battle.mapName,
    battleType: battle.battleType,
    gameplayId,
  };
  const spots: NewBattleSpotRow[] = built.spots.map((row) => ({ ...row, ...stamp }));
  const hits: NewBattleHitRow[] = built.hits.map((row) => ({ ...row, ...stamp }));
  const spotsTable = battleSpotsByRegion[region];
  const hitsTable = battleHitsByRegion[region];
  await db.transaction(async (tx) => {
    await tx.delete(spotsTable).where(eq(spotsTable.arenaUniqueId, arenaUniqueId));
    await tx.delete(hitsTable).where(eq(hitsTable.arenaUniqueId, arenaUniqueId));
    if (spots.length > 0) await tx.insert(spotsTable).values(spots);
    // A battle's hits run to a couple of hundred, well inside one statement.
    if (hits.length > 0) {
      await tx.insert(hitsTable).values(hits).onConflictDoNothing();
    }
  });
  return { spots: spots.length, hits: hits.length };
}

type Stamp = "arenaUniqueId" | "startedAt" | "mapName" | "battleType" | "gameplayId" | "createdAt";
export type SpotRow = Omit<NewBattleSpotRow, Stamp>;
export type HitRow = Omit<NewBattleHitRow, Stamp>;

/**
 * The spots and hits one recording yields, with no database involved: the
 * replay, the battle's own results, the box to project into and each tank's
 * class.
 *
 * Kept pure so it can be run against a replay file on disk, which is the only
 * way to look at one: the archive answers from inside the deployment alone.
 */
export function positionRowsOf(
  { blocks, stream }: ReplayContainer,
  battle: { winnerTeam: number | null; vehicles: BattleVehicle[] },
  box: { bottomLeft: MapPoint; upperRight: MapPoint },
  classes: Map<number, string>,
): { spots: SpotRow[]; hits: HitRow[] } | { skipped: PositionSkip } {
  if (stream.length === 0) return { skipped: PositionSkip.NoStream };

  // The recorder's side. The header names the account that recorded, and the
  // results name each account's team, so the side comes from the results
  // rather than from a header field whose numbering we would have to trust.
  const header = blocks[0] as { playerID?: unknown } | null;
  const recorder = Number(header?.playerID);
  const team = battle.vehicles.find((vehicle) => vehicle.account === recorder)?.team;
  if (!team) return { skipped: PositionSkip.NoRecorder };

  const motion = readMotion(stream);
  const roster = battle.vehicles.map((vehicle) => ({
    ...vehicle,
    lifeTime: Number(vehicle.lifeTime ?? 0),
    died: Number(vehicle.deathReason ?? -1) >= 0,
  }));
  const tracks = new Map(motion.tracks.map((track) => [track.id, track]));
  // Team mates with an account and a known class: bots are not players, the
  // rule every other figure on the map follows.
  const mates = new Map(
    roster
      .filter(
        (vehicle) =>
          vehicle.team === team && vehicle.account && classes.has(vehicle.tank),
      )
      .map((vehicle) => [vehicle.id, vehicle]),
  );
  const from =
    replayClockOffset(
      motion.tracks.flatMap((track) =>
        track.points.length > 0
          ? [{ id: track.id, last: track.points[track.points.length - 1][0] }]
          : [],
      ),
      roster,
    ) ??
    // A recording whose player left before the end has no survivor to anchor
    // on, and that is common enough to be worth the second reading.
    replayStartFromMovement(
      [...mates.values()].flatMap((vehicle) => {
        const track = tracks.get(vehicle.id);
        return track ? [track] : [];
      }),
    );
  if (from === null) return { skipped: PositionSkip.NoClock };

  const place = (point: { x: number; z: number }) => {
    const { left, top } = projectPoint(point, box);
    return {
      left: Math.round(left * 100) / 100,
      top: Math.round(top * 100) / 100,
    };
  };

  const spots: SpotRow[] = [];
  for (const vehicle of mates.values()) {
    const track = tracks.get(vehicle.id);
    if (!track) continue;
    const until = Math.min(
      motion.duration,
      vehicle.died ? from + vehicle.lifeTime : Number.POSITIVE_INFINITY,
    );
    const spot = settleSpot(track.points, from, until);
    if (!spot) continue;
    spots.push({
      vehicleId: vehicle.id,
      team,
      tankId: vehicle.tank,
      vehicleClass: classes.get(vehicle.tank)!,
      settledAt: Math.round((spot.at - from) * 10) / 10,
      ...place(spot),
      damage: Number(vehicle.damage ?? 0),
      kills: Number(vehicle.kills ?? 0),
      survived: !vehicle.died,
      won: battle.winnerTeam === team,
    });
  }

  const teamOf = new Map(roster.map((vehicle) => [vehicle.id, vehicle.team]));
  const hits: HitRow[] = [];
  for (const hit of motion.hits) {
    const attacker = mates.get(hit.by);
    if (!attacker || hit.at < from) continue;
    // Friendly fire is damage, but not damage anybody is looking to farm.
    if (teamOf.get(hit.victim) === team) continue;
    const track = tracks.get(attacker.id);
    const where = track ? positionAt(track.points, hit.at) : null;
    if (!where) continue;
    hits.push({
      at: Math.round((hit.at - from) * 100) / 100,
      victimId: hit.victim,
      attackerId: attacker.id,
      team,
      tankId: attacker.tank,
      vehicleClass: classes.get(attacker.tank)!,
      ...place(where),
      damage: hit.damage,
      fatal: hit.fatal,
    });
  }
  return { spots, hits };
}

/** Each tank's class tag, from the region's vehicle catalogue. */
async function vehicleClasses(
  region: Region,
  tanks: number[],
): Promise<Map<number, string>> {
  if (tanks.length === 0) return new Map();
  const vehicles = vehiclesByRegion[region];
  const rows = await db
    .select({ tankId: vehicles.tankId, type: vehicles.type })
    .from(vehicles)
    .where(inArray(vehicles.tankId, [...new Set(tanks)]));
  return new Map(rows.map((row) => [row.tankId, row.type] as const));
}

/** What one pass of the backfill did, and where the next one starts. */
export interface PositionBackfill {
  /** Battles whose file was opened. */
  read: number;
  /** Battles that yielded rows. */
  filled: number;
  spots: number;
  hits: number;
  /** Battles that yielded nothing, by reason. */
  skipped: Partial<Record<PositionSkip, number>>;
  /** Battles whose file could not be fetched or read. */
  failed: number;
  /** The last battle's `startedAt`, to hand back as `after`. Null at the end. */
  next: Date | null;
}

/**
 * Re-read archived recordings and write their spots and hits.
 *
 * The same shape as the loadout backfill: called from the cron route, which
 * runs where the archive answers (a laptop cannot reach the bucket), one file
 * at a time and with a cursor rather than a stored position, so a pass can be
 * retried, resumed, or run from anywhere.
 */
export async function backfillBattlePositions(
  region: Region,
  options: {
    limit?: number;
    /** Only battles that started strictly after this. */
    after?: Date | null;
    /** One battle, by arena id. */
    arenaUniqueId?: string | null;
    /** Re-read battles that already have rows, after a change to the reading. */
    force?: boolean;
    onFailure?: (arenaUniqueId: string, reason: unknown) => void;
  } = {},
): Promise<PositionBackfill> {
  const battles = battlesByRegion[region];
  const spots = battleSpotsByRegion[region];
  const limit = Math.max(1, Math.min(options.limit ?? 25, 500));

  const conditions = [isNotNull(battles.replayKey)];
  if (options.arenaUniqueId) {
    conditions.push(eq(battles.arenaUniqueId, options.arenaUniqueId));
  }
  if (options.after) conditions.push(gt(battles.startedAt, options.after));
  if (!options.force && !options.arenaUniqueId) {
    conditions.push(sql`not exists (
      select 1 from ${spots}
      where ${spots.arenaUniqueId} = ${battles.arenaUniqueId}
    )`);
  }

  const todo = await db
    .select({
      arenaUniqueId: battles.arenaUniqueId,
      startedAt: battles.startedAt,
      key: battles.replayKey,
    })
    .from(battles)
    .where(and(...conditions))
    .orderBy(battles.startedAt)
    .limit(limit);

  const out: PositionBackfill = {
    read: 0,
    filled: 0,
    spots: 0,
    hits: 0,
    skipped: {},
    failed: 0,
    next: null,
  };
  for (const battle of todo) {
    if (!battle.key) continue;
    out.read += 1;
    out.next = battle.startedAt;
    try {
      const file = await fetchReplay(battle.key);
      if (!file) {
        out.failed += 1;
        options.onFailure?.(
          battle.arenaUniqueId,
          `the archive no longer holds ${battle.key}`,
        );
        continue;
      }
      const written = await storePositionsFromReplay(
        region,
        battle.arenaUniqueId,
        battle.startedAt,
        file,
      );
      if ("skipped" in written) {
        out.skipped[written.skipped] = (out.skipped[written.skipped] ?? 0) + 1;
        continue;
      }
      out.filled += 1;
      out.spots += written.spots;
      out.hits += written.hits;
    } catch (error) {
      out.failed += 1;
      options.onFailure?.(battle.arenaUniqueId, error);
    }
  }
  if (todo.length < limit) out.next = null;
  return out;
}
