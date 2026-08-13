import { and, eq, inArray, sql } from "drizzle-orm";
import {
  BattleFormat,
  BattleResult,
  clansByRegion,
  FORMAT_TEAM_SIZE,
  FORMAT_TIER,
  SPAWN_DIRECTION_LABEL,
  spawnDirection,
  tankVideos,
  TankVideoStatus,
  type MapGameMode,
  type SpawnDirection,
} from "@unicum.gg/shared";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";

/**
 * Turning stored rows into what a page reads.
 *
 * Two things are worked out here rather than stored, and both for the same
 * reason: they would otherwise be able to contradict the thing they describe.
 * The spawn direction comes from the map's own geometry, so a side can never
 * name a compass point the map does not have, and the clan comes from its id,
 * so a rename cannot strand the credit.
 */

/** A clan as a video credits it: enough to name it, link it, colour it and draw
 * it, the same four things every other clan row on the site is built from. */
export type ClanCredit = {
  region: Region;
  id: number;
  tag: string;
  name: string;
  color: string | null;
  emblem: string | null;
};

function clanKey(region: string | null, id: number | null): string {
  return `${region}:${id}`;
}

/**
 * Names the clans a batch of rows credits, one query per region rather than one
 * per row.
 *
 * The rows store an id, not a tag, so this is where the credit is turned back
 * into something readable. A row naming a clan we do not track resolves to
 * nothing rather than to a broken link: the tag is not ours to invent.
 */
async function resolveClans(
  rows: (typeof tankVideos.$inferSelect)[],
): Promise<Map<string, ClanCredit>> {
  const wanted = new Map<Region, Set<number>>();
  for (const row of rows) {
    if (!row.clanRegion || row.clanId === null) continue;
    if (!isRegion(row.clanRegion)) continue;
    const ids = wanted.get(row.clanRegion) ?? new Set<number>();
    ids.add(row.clanId);
    wanted.set(row.clanRegion, ids);
  }

  const out = new Map<string, ClanCredit>();
  await Promise.all(
    [...wanted].map(async ([region, ids]) => {
      const table = clansByRegion[region];
      const found = await db
        .select({
          id: table.id,
          tag: table.tag,
          name: table.name,
          color: table.color,
          emblem: table.emblem,
        })
        .from(table)
        .where(inArray(table.id, [...ids]));
      for (const clan of found) {
        out.set(clanKey(region, clan.id), { region, ...clan });
      }
    }),
  );
  return out;
}

/**
 * Turns stored rows into what a page reads, in the same order.
 *
 * The direction is worked out here rather than stored: the submitter tells us
 * which side they spawned on, and the map's own geometry says what that side is
 * called. Deriving it means the label can never contradict the map, and the
 * catalogue behind it is memoized per region for a day, so this costs no
 * network call.
 */
export async function decorateVideos(
  region: Region,
  rows: (typeof tankVideos.$inferSelect)[],
): Promise<TankVideo[]> {
  const clans = await resolveClans(rows);
  const maps = new Map<string, Awaited<ReturnType<typeof getMapDetailBySlug>>>();
  const out: TankVideo[] = [];
  for (const row of rows) {
    const format = (row.format as BattleFormat | null) ?? BattleFormat.Random;
    let direction: SpawnDirection | null = null;
    let mapName: string | null = null;
    let mapSlug: string | null = null;
    if (row.arenaId) {
      if (!maps.has(row.arenaId)) {
        maps.set(
          row.arenaId,
          await getMapDetailBySlug(region, row.arenaId).catch(() => null),
        );
      }
      const detail = maps.get(row.arenaId) ?? null;
      mapName = detail?.name ?? null;
      mapSlug = detail?.slug ?? null;
      const geometry = detail?.geometry.find((g) => g.mode === row.mode);
      if (geometry && (row.spawnTeam === 1 || row.spawnTeam === 2)) {
        direction = spawnDirection(geometry, row.spawnTeam);
      }
    }
    out.push({
      id: row.id,
      videoId: row.videoId,
      startSeconds: row.startSeconds,
      title: row.title,
      channelName: row.channelName,
      mapName,
      mapSlug,
      mode: (row.mode as MapGameMode | null) ?? null,
      direction,
      directionLabel: direction ? SPAWN_DIRECTION_LABEL[direction] : null,
      result: (row.result as BattleResult | null) ?? null,
      format,
      // Read through the format first: the stored columns are only filled where
      // the format leaves them open, so this is what makes a Clan Wars row
      // answer 15 and X without anyone having typed them.
      teamSize: FORMAT_TEAM_SIZE[format] ?? row.teamSize,
      tier: FORMAT_TIER[format] ?? row.tier,
      clan: clans.get(clanKey(row.clanRegion, row.clanId)) ?? null,
      combinedDamage: row.combinedDamage,
      gameVersion: row.gameVersion,
    });
  }
  return out;
}

/** A video as a page renders it. */
export type TankVideo = {
  id: number;
  videoId: string;
  startSeconds: number;
  title: string;
  channelName: string;
  mapName: string | null;
  /** The map's own page, where a tactic is looked up. */
  mapSlug: string | null;
  mode: MapGameMode | null;
  /** What was being played. `random` on everything submitted before tactics
   * existed, which is what those were. */
  format: BattleFormat;
  /** Players per team and the tier fought at, read through the format first, so
   * a Clan Wars row answers 15 and X without anyone having typed them. */
  teamSize: number | null;
  tier: number | null;
  /** The clan the battle was played for, resolved from the stored id so a rename
   * cannot strand the credit. Null when none was claimed, and also when the id
   * names a clan we do not track. Carries its colour, since a tag is rendered
   * in it everywhere else on the site. */
  clan: ClanCredit | null;
  /** Derived from the map's spawn geometry, never declared. */
  direction: SpawnDirection | null;
  directionLabel: string | null;
  result: BattleResult | null;
  /** Damage dealt plus assisted, as declared. */
  combinedDamage: number | null;
  gameVersion: string | null;
};

/** How many published videos a tank has, for the "Videos (N)" tab label. Reads
 * the count alone, so the tab label costs nothing on tabs that never render the
 * list. */
export async function countTankVideos(tankId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(tankVideos)
    .where(
      and(
        eq(tankVideos.tankId, tankId),
        eq(tankVideos.status, TankVideoStatus.Approved),
      ),
    );
  return row?.n ?? 0;
}

/** A published battle on the global index, which crosses tanks: the same video
 * legitimately carries battles of several.
 *
 * Every tank field is nullable, because a competitive tactic has no vehicle to
 * name: it is filed under the map it is fought on. The index shows both, so the
 * shape has to admit both. */
export type CommunityVideo = TankVideo & {
  tankId: number | null;
  tankName: string | null;
  tankSlug: string | null;
  /** The tank's own catalogue fields, carried so the index can present and
   * filter a battle the way the tank list presents and filters a vehicle:
   * by tier, nation, class and role. */
  tankShortName: string | null;
  tankTag: string | null;
  vehicleTier: number | null;
  nation: string | null;
  type: string | null;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
};
