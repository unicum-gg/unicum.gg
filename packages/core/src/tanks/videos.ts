import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  APP_IDENTITY,
  BATTLE_RESULT_LABEL,
  BattleResult,
  BRAND_COLOR_INT,
  env,
  MAP_GAME_MODE_LABEL,
  parseYoutubeUrl,
  SPAWN_DIRECTION_LABEL,
  spawnDirection,
  tankVideos,
  TankVideoStatus,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type MapGameMode,
  type SpawnDirection,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import {
  discordBotEnabled,
  postChannelEmbedWithComponents,
} from "@unicum.gg/core/discord";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { wg } from "@unicum.gg/core/wargaming/client";

/**
 * Community-suggested gameplay videos.
 *
 * One row is one battle, not one video: what is worth linking in a three-hour
 * VOD is the minute this tank is played, so every submission carries a start
 * time and the same video legitimately comes back for other tanks and other
 * minutes.
 *
 * Everything the submitter declares beyond the link is unverifiable from here,
 * which is the whole reason a moderation queue exists rather than direct
 * publication.
 */

/** Every board the moderation card needs to identify a submission. */
export type VideoSubmission = {
  tankId: number;
  /** For the moderation card and the link back to the page it came from. */
  tankName: string;
  tankSlug: string;
  region: Region;
  url: string;
  /** Overrides the link's own `?t=`, which is absent whenever the link was
   * copied without "start at current time". The only optional part of a
   * submission: a short video devoted to the tank opens on the battle. */
  startSeconds?: number | null;
  // The battle context, all required: one row is one battle, and a row missing
  // its map or side cannot be filtered and gives a moderator nothing to check
  // the video against. The columns behind them stay nullable so a future
  // non-battle entry (a guide, a review) needs no migration.
  arenaId: string;
  mode: MapGameMode;
  spawnTeam: 1 | 2;
  result: BattleResult;
  /** Damage dealt plus assisted, read off the after-battle screen. */
  combinedDamage: number;
  /** Better Auth user id. Sign-in is required to submit. */
  userId: string;
  /** WG nickname, shown on the card so a moderator knows who is asking. */
  submitterName: string;
};

export enum SubmitVideoOutcome {
  Queued = "queued",
  /** The link is not a YouTube video we can embed. */
  InvalidUrl = "invalid_url",
  /** This exact battle is already queued, live, or was turned down. */
  Duplicate = "duplicate",
  /** YouTube would not tell us what the video is (deleted, private, blocked). */
  Unreachable = "unreachable",
  /** No bot or no channel: nothing could review it, so nothing is accepted. */
  Disabled = "disabled",
}

export type SubmitVideoResult = {
  outcome: SubmitVideoOutcome;
  videoId?: string;
};

/** Submissions are only open when a moderator could actually see them. */
export function videoSubmissionsEnabled(): boolean {
  return discordBotEnabled() && Boolean(env.DISCORD_VIDEO_CHANNEL_ID);
}

type Oembed = { title: string; author_name: string };

/**
 * What YouTube says a video is. oEmbed needs no API key and no quota, and it
 * fails exactly where we want to refuse anyway: a deleted, private or
 * embedding-disabled video answers 401/404, so a link nobody could watch never
 * reaches the queue.
 */
async function fetchOembed(videoId: string): Promise<Oembed | null> {
  const target = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`,
    { signal: AbortSignal.timeout(8000) },
  ).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as Oembed | null;
  return data?.title ? data : null;
}

/**
 * The client version in play, stamped at submission rather than asked for.
 *
 * Balance moves between patches, so a reader wants to know a video is two
 * patches old, but a submitter would be guessing. Null when WG does not answer:
 * an unknown version is better than a wrong one.
 */
async function currentGameVersion(region: Region): Promise<string | null> {
  return wg
    .region(region)
    .api.wot.encyclopedia.info({ fields: ["game_version"] })
    .then((info) => info.game_version ?? null)
    .catch(() => null);
}

/** Whether the declared map and mode exist and go together. A map that does not
 * run Assault must not carry an Assault video: the filter it feeds would then
 * lie about which battles happened where. */
async function mapIsConsistent(
  region: Region,
  arenaId: string,
  mode: MapGameMode,
): Promise<boolean> {
  const detail = await getMapDetailBySlug(region, arenaId).catch(() => null);
  if (!detail) return false;
  return detail.modes.includes(mode);
}

/**
 * Queue a suggestion and put its card in the moderation channel.
 *
 * Nothing is published here: the row lands as `pending` and only a moderator's
 * press moves it. The insert is `onConflictDoNothing` against the one-row-per-
 * battle index, so a second submission of the same battle is answered as a
 * duplicate instead of queueing a card nobody needs to look at twice.
 */
export async function submitTankVideo(
  submission: VideoSubmission,
): Promise<SubmitVideoResult> {
  if (!videoSubmissionsEnabled()) {
    return { outcome: SubmitVideoOutcome.Disabled };
  }

  const parsed = parseYoutubeUrl(submission.url);
  if (!parsed) return { outcome: SubmitVideoOutcome.InvalidUrl };
  // An explicit start time wins over the link's own: the form lets it be typed
  // or corrected, and a link copied plainly carries none.
  const ref = {
    ...parsed,
    startSeconds:
      typeof submission.startSeconds === "number"
        ? submission.startSeconds
        : parsed.startSeconds,
  };

  if (
    !(await mapIsConsistent(
      submission.region,
      submission.arenaId,
      submission.mode,
    ))
  ) {
    return { outcome: SubmitVideoOutcome.InvalidUrl };
  }

  const oembed = await fetchOembed(ref.videoId);
  if (!oembed) return { outcome: SubmitVideoOutcome.Unreachable };

  const [row] = await db
    .insert(tankVideos)
    .values({
      tankId: submission.tankId,
      videoId: ref.videoId,
      startSeconds: ref.startSeconds,
      // Trimmed: oEmbed pads these, and they are read back into the page
      // title and into the video's structured data.
      title: oembed.title.trim(),
      channelName: oembed.author_name.trim(),
      arenaId: submission.arenaId,
      mode: submission.mode,
      spawnTeam: submission.spawnTeam,
      result: submission.result,
      combinedDamage: submission.combinedDamage,
      gameVersion: await currentGameVersion(submission.region),
      status: TankVideoStatus.Pending,
      submittedBy: submission.userId,
    })
    .onConflictDoNothing({
      target: [tankVideos.tankId, tankVideos.videoId, tankVideos.startSeconds],
    })
    .returning({ id: tankVideos.id });

  if (!row) return { outcome: SubmitVideoOutcome.Duplicate };

  // Best-effort: the row is queued either way, and a moderator can still find
  // it. Failing the submission because Discord hiccuped would ask the person to
  // send it again, which the unique index would then refuse as a duplicate.
  await postModerationCard(row.id, ref, oembed, submission).catch((err) =>
    console.error("[tank-videos] moderation card failed:", err),
  );

  return { outcome: SubmitVideoOutcome.Queued, videoId: ref.videoId };
}

/** `video:approve:<id>` / `video:reject:<id>`, read back by the bot. The row id
 * rides in the button rather than in memory so the buttons keep working across
 * a redeploy, which a component collector would not. */
export const VIDEO_REVIEW_PREFIX = "video";

async function postModerationCard(
  id: number,
  ref: { videoId: string; startSeconds: number },
  oembed: Oembed,
  s: VideoSubmission,
): Promise<void> {
  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Tank", value: s.tankName, inline: true },
    { name: "Channel", value: oembed.author_name, inline: true },
    { name: "Submitted by", value: s.submitterName, inline: true },
  ];
  if (s.arenaId) {
    fields.push({ name: "Map", value: s.arenaId, inline: true });
  }
  if (s.mode) {
    fields.push({
      name: "Mode",
      value: MAP_GAME_MODE_LABEL[s.mode] ?? s.mode,
      inline: true,
    });
  }
  if (s.result) {
    fields.push({
      name: "Result",
      value: BATTLE_RESULT_LABEL[s.result],
      inline: true,
    });
  }
  if (s.combinedDamage != null) {
    fields.push({
      name: "Combined",
      value: s.combinedDamage.toLocaleString("en-US"),
      inline: true,
    });
  }

  await postChannelEmbedWithComponents(
    env.DISCORD_VIDEO_CHANNEL_ID!,
    {
      title: oembed.title,
      url: youtubeWatchUrl(ref.videoId, ref.startSeconds),
      description: `Opens at the battle. Everything below the channel is declared by the submitter.`,
      color: BRAND_COLOR_INT,
      thumbnail: { url: youtubeThumbnailUrl(ref.videoId) },
      fields,
      footer: { text: `${APP_IDENTITY.NAME} · /${s.region}/tanks/${s.tankSlug}` },
    },
    [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "Approve",
            custom_id: `${VIDEO_REVIEW_PREFIX}:approve:${id}`,
          },
          {
            type: 2,
            style: 4,
            label: "Reject",
            custom_id: `${VIDEO_REVIEW_PREFIX}:reject:${id}`,
          },
        ],
      },
    ],
  );
}

/** A video as the tank page renders it. */
export type TankVideo = {
  id: number;
  videoId: string;
  startSeconds: number;
  title: string;
  channelName: string;
  mapName: string | null;
  mode: MapGameMode | null;
  /** Derived from the map's spawn geometry, never declared. */
  direction: SpawnDirection | null;
  directionLabel: string | null;
  result: BattleResult | null;
  /** Damage dealt plus assisted, as declared. */
  combinedDamage: number | null;
  gameVersion: string | null;
};

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
 * A submitter's own queued battles for one tank, newest first.
 *
 * Only ever their own: a pending row is unreviewed, so it is shown to the
 * person waiting on it and to nobody else. It exists because a suggestion
 * disappears into a queue otherwise, and there is no way to tell "not sent"
 * from "not looked at yet" without asking a moderator.
 */
export async function listPendingVideosFor(
  region: Region,
  tankId: number,
  userId: string,
): Promise<TankVideo[]> {
  const rows = await db
    .select()
    .from(tankVideos)
    .where(
      and(
        eq(tankVideos.tankId, tankId),
        eq(tankVideos.status, TankVideoStatus.Pending),
        eq(tankVideos.submittedBy, userId),
      ),
    )
    .orderBy(desc(tankVideos.submittedAt));

  return decorateVideos(region, rows);
}

/** A published battle on the global index, which crosses tanks: the same video
 * legitimately carries battles of several. */
export type CommunityVideo = TankVideo & {
  tankId: number;
  tankName: string;
  tankSlug: string;
  /** The tank's own catalogue fields, carried so the index can present and
   * filter a battle the way the tank list presents and filters a vehicle:
   * by tier, nation, class and role. */
  tankShortName: string;
  tankTag: string;
  tier: number;
  nation: string;
  type: string;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
};

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

  const [videos, tanks] = await Promise.all([
    decorateVideos(region, rows),
    listTanks(region),
  ]);
  const byId = new Map(tanks.map((t) => [t.tankId, t]));

  const out: CommunityVideo[] = [];
  videos.forEach((video, i) => {
    const tank = byId.get(rows[i].tankId);
    // A battle whose tank left the catalogue is dropped rather than shown
    // nameless: the row exists to send someone to that tank's page.
    if (!tank) return;
    out.push({
      ...video,
      tankId: tank.tankId,
      tankName: tank.meta.name,
      tankSlug: tank.slug,
      tankShortName: tank.meta.shortName,
      tankTag: tank.meta.tag,
      tier: tank.meta.tier,
      nation: tank.meta.nation,
      type: tank.meta.type,
      role: tank.meta.role ?? null,
      isPremium: tank.meta.isPremium,
      isReward: tank.meta.isReward,
    });
  });
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
async function decorateVideos(
  region: Region,
  rows: (typeof tankVideos.$inferSelect)[],
): Promise<TankVideo[]> {
  const maps = new Map<string, Awaited<ReturnType<typeof getMapDetailBySlug>>>();
  const out: TankVideo[] = [];
  for (const row of rows) {
    let direction: SpawnDirection | null = null;
    let mapName: string | null = null;
    if (row.arenaId) {
      if (!maps.has(row.arenaId)) {
        maps.set(
          row.arenaId,
          await getMapDetailBySlug(region, row.arenaId).catch(() => null),
        );
      }
      const detail = maps.get(row.arenaId) ?? null;
      mapName = detail?.name ?? null;
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
      mode: (row.mode as MapGameMode | null) ?? null,
      direction,
      directionLabel: direction ? SPAWN_DIRECTION_LABEL[direction] : null,
      result: (row.result as BattleResult | null) ?? null,
      combinedDamage: row.combinedDamage,
      gameVersion: row.gameVersion,
    });
  }
  return out;
}

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

export type ReviewedVideo = {
  tankId: number;
  title: string;
  status: TankVideoStatus;
};

/**
 * Settle a queued submission. Returns what was settled so the caller can name
 * it back in the channel and revalidate the tank page, or null when the id is
 * unknown or someone already pressed a button on it. The guard on `status`
 * makes a double press a no-op rather than a second state change.
 */
export async function reviewTankVideo(
  id: number,
  approved: boolean,
  moderatorId: string,
): Promise<ReviewedVideo | null> {
  const status = approved
    ? TankVideoStatus.Approved
    : TankVideoStatus.Rejected;
  const [row] = await db
    .update(tankVideos)
    .set({ status, reviewedAt: new Date(), reviewedBy: moderatorId })
    .where(
      and(
        eq(tankVideos.id, id),
        eq(tankVideos.status, TankVideoStatus.Pending),
      ),
    )
    .returning({ tankId: tankVideos.tankId, title: tankVideos.title });
  return row ? { ...row, status } : null;
}
