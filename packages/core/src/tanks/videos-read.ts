import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import {
  decorateVideos,
  type CommunityVideo,
  type TankVideo,
} from "@unicum.gg/core/tanks/video-rows";

/**
 * Reading the community's videos back.
 *
 * Five slices of one table, because five pages ask five different questions of
 * it: a tank's battles, a map's, a clan's, one recording's whole timeline, and
 * what is new across all of them. They share their decoration, which is where
 * the spawn direction and the clan credit are worked out, and differ only in
 * what they select and in what order.
 *
 * Kept apart from the submission side, which owes nothing to any of this: it
 * talks to YouTube and to Discord, and writes exactly one row.
 */

/**
 * This tank's published videos, newest first.
 *
 * The direction is worked out here rather than stored: the submitter tells us
 * which side they spawned on, and the map's own geometry says what that side is
 * called. Deriving it means the label can never contradict the map, and the
 * catalogue behind it is memoized per region for a day, so this costs no
 * network call.
 */
export async function listTankVideos(
  region: Region,
  tankId: number,
): Promise<TankVideo[]> {
  const rows = await db
    .select()
    .from(tankVideos)
    .where(
      and(
        eq(tankVideos.tankId, tankId),
        eq(tankVideos.status, TankVideoStatus.Approved),
      ),
    )
    .orderBy(desc(tankVideos.reviewedAt), asc(tankVideos.id));

  return decorateVideos(region, rows);
}

/**
 * A submitter's own queued battles, newest first, wherever they were filed.
 *
 * Only ever their own: a pending row is unreviewed, so it is shown to the
 * person waiting on it and to nobody else. It exists because a suggestion
 * disappears into a queue otherwise, and there is no way to tell "not sent"
 * from "not looked at yet" without asking a moderator.
 *
 * Not scoped to one tank or one map, because someone waiting on a review is
 * waiting on all of them: the page that renders the list keeps the rows it is
 * about, and a person's own queue is a handful of rows either way.
 */
export async function listPendingVideosFor(
  region: Region,
  userId: string,
): Promise<CommunityVideo[]> {
  const rows = await db
    .select()
    .from(tankVideos)
    .where(
      and(
        eq(tankVideos.status, TankVideoStatus.Pending),
        eq(tankVideos.submittedBy, userId),
      ),
    )
    .orderBy(desc(tankVideos.submittedAt));

  return withTanks(region, rows);
}

/**
 * Every published battle a clan is credited on, newest approved first.
 *
 * A clan's own record of what it has published: the tactics it called, on the
 * maps it called them. Scoped by region as well as id, because clan ids are
 * region-scoped and two regions can hand out the same number.
 */
export async function listClanVideos(
  region: Region,
  clanId: number,
): Promise<CommunityVideo[]> {
  const rows = await db
    .select()
    .from(tankVideos)
    .where(
      and(
        eq(tankVideos.clanRegion, region),
        eq(tankVideos.clanId, clanId),
        eq(tankVideos.status, TankVideoStatus.Approved),
      ),
    )
    .orderBy(desc(tankVideos.reviewedAt), asc(tankVideos.id));

  return withTanks(region, rows);
}

/**
 * Every published battle marked in one video, in the order they happen.
 *
 * What a seek bar needs. The page a video is opened from only knows its own
 * slice of it, a tank's battles or a map's, but the recording is one timeline:
 * a clan evening runs through a rotation, and while watching the Steppes battle
 * the useful thing is seeing where the next map starts.
 *
 * Uncapped, unlike the index: a video holds a dozen battles at the very most.
 */
export async function listVideoBattles(
  region: Region,
  videoId: string,
): Promise<CommunityVideo[]> {
  const rows = await db
    .select()
    .from(tankVideos)
    .where(
      and(
        eq(tankVideos.videoId, videoId),
        eq(tankVideos.status, TankVideoStatus.Approved),
      ),
    )
    .orderBy(asc(tankVideos.startSeconds));

  return withTanks(region, rows);
}

/**
 * Every published battle fought on one map, newest approved first.
 *
 * The read behind a tactic library. A map page wants the opposite slice of the
 * table from a tank page: there the vehicle is fixed and the ground varies,
 * here the ground is fixed and what varies is the format, the side and who was
 * playing. Random battles are returned alongside the competitive ones, because
 * the page filters by format and a good game on this map is worth watching
 * whatever it was played in.
 */
export async function listMapVideos(
  region: Region,
  arenaId: string,
): Promise<CommunityVideo[]> {
  const rows = await db
    .select()
    .from(tankVideos)
    .where(
      and(
        eq(tankVideos.arenaId, arenaId),
        eq(tankVideos.status, TankVideoStatus.Approved),
      ),
    )
    .orderBy(desc(tankVideos.reviewedAt), asc(tankVideos.id));

  return withTanks(region, rows);
}


/**
 * Every published battle, newest first, whatever the tank.
 *
 * The per-tank pages each show their own slice of a video, so this is the only
 * place a recording is seen whole, with every tank it covers. Capped rather
 * than paginated: it is a shop window, and the tank pages are where a video is
 * looked up on purpose.
 */
export async function listRecentVideos(
  region: Region,
  limit = 90,
): Promise<CommunityVideo[]> {
  const rows = await db
    .select()
    .from(tankVideos)
    .where(eq(tankVideos.status, TankVideoStatus.Approved))
    .orderBy(desc(tankVideos.reviewedAt), asc(tankVideos.id))
    .limit(limit);

  return withTanks(region, rows);
}

/**
 * Decorates rows and names the vehicle each was played in.
 *
 * The lists that cross tanks read this: the community index and a map's own
 * page. A row with no tank is a competitive tactic and keeps its nulls rather
 * than borrowing the camera's vehicle, and a row naming a tank the catalogue no
 * longer has is dropped, since it exists to send someone to that tank's page.
 */
async function withTanks(
  region: Region,
  rows: (typeof tankVideos.$inferSelect)[],
): Promise<CommunityVideo[]> {
  const [videos, tanks] = await Promise.all([
    decorateVideos(region, rows),
    listTanks(region),
  ]);
  const byId = new Map(tanks.map((t) => [t.tankId, t]));

  const out: CommunityVideo[] = [];
  videos.forEach((video, i) => {
    const tankId = rows[i].tankId;
    const tank = tankId === null ? null : byId.get(tankId);
    if (tankId !== null && !tank) return;
    out.push({
      ...video,
      tankId: tank?.tankId ?? null,
      tankName: tank?.meta.name ?? null,
      tankSlug: tank?.slug ?? null,
      tankShortName: tank?.meta.shortName ?? null,
      tankTag: tank?.meta.tag ?? null,
      vehicleTier: tank?.meta.tier ?? null,
      nation: tank?.meta.nation ?? null,
      type: tank?.meta.type ?? null,
      role: tank?.meta.role ?? null,
      isPremium: tank?.meta.isPremium ?? false,
      isReward: tank?.meta.isReward ?? false,
    });
  });
  return out;
}
