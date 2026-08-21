import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
// Default-imported, not destructured at the import: the package is CommonJS,
// and Node's ESM loader finds no named export on it. A bundler papers over
// that, `tsx` does not, so the named form would break the day anything run
// directly (the worker, a script) imported this module.
import romanNumerals from "roman-numerals";

const { toRoman } = romanNumerals as { toRoman: (n: number) => string };
import {
  APP_IDENTITY,
  BATTLE_FORMAT_LABEL,
  BATTLE_RESULT_LABEL,
  BattleFormat,
  BattleResult,
  FORMAT_TEAM_SIZE,
  FORMAT_TIER,
  BRAND_COLOR_INT,
  env,
  MAP_GAME_MODE_LABEL,
  parseYoutubeUrl,
  SPAWN_DIRECTION_LABEL,
  spawnDirection,
  clansByRegion,
  tankVideos,
  TankVideoStatus,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type MapGameMode,
  type SpawnDirection,
} from "@unicum.gg/shared";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import {
  discordBotEnabled,
  postChannelEmbedWithComponents,
} from "@unicum.gg/core/discord";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import {
  postModerationCard,
  VIDEO_REVIEW_PREFIX,
} from "@unicum.gg/core/tanks/video-moderation-card";
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
  /** The vehicle, when the battle is about one. Null on a competitive tactic,
   * which is about a map and a side: a shot-caller looks it up by the ground it
   * is fought on, not by what the camera happened to be sitting in. */
  tankId: number | null;
  /** For the moderation card and the link back to the page it came from. */
  tankName: string | null;
  tankSlug: string | null;
  /** The map, for the same reasons, and always known: it is the axis a tactic is
   * filed under, and the only page a tank-less video can live on. */
  mapName: string;
  mapSlug: string;
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
  /** What was being played. Everything but `Random` makes this a tactic: the
   * video belongs to the map, the vehicle becomes optional, and the numbers a
   * single player scored stop being the point. */
  format: BattleFormat;
  /** Damage dealt plus assisted, read off the after-battle screen. Asked for on
   * a random battle, where it is what makes two of them comparable, and left
   * out of a tactic, where nobody is looking up one player's game. */
  combinedDamage: number | null;
  /** Players per team and the tier fought at, only where the format does not
   * fix them: Clan Wars and Advances are tier X fifteens, Onslaught a tier X
   * seven, and asking would be asking someone to retype a rule. */
  teamSize?: number | null;
  tier?: number | null;
  /** The clan the battle was played for, credited on its own page. Optional: an
   * independent caller has a tactic worth publishing too. */
  clanRegion?: Region | null;
  clanId?: number | null;
  /** For the moderation card only. What is stored is the id, since tags get
   * renamed and the credit has to survive it. */
  clanTag?: string | null;
  /** Better Auth user id. Sign-in is required to submit. */
  userId: string;
  /** WG nickname, shown on the card so a moderator knows who is asking. */
  submitterName: string;
};

export { VIDEO_REVIEW_PREFIX };

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

/** What oEmbed answers with, for the card that shows it. */
export type Oembed = { title: string; author_name: string };

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
      format: submission.format,
      combinedDamage: submission.combinedDamage,
      // Stored only where the format leaves them open, so a Clan Wars row never
      // depends on someone having typed 15 and X correctly.
      teamSize: FORMAT_TEAM_SIZE[submission.format] ? null : submission.teamSize,
      tier: FORMAT_TIER[submission.format] ? null : submission.tier,
      clanRegion: submission.clanRegion ?? null,
      clanId: submission.clanId ?? null,
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

export type ReviewedVideo = {
  /** Null on a tactic, which has no tank page to drop from the cache. */
  tankId: number | null;
  /** The map it was fought on, whose page carries it either way. */
  arenaId: string | null;
  /** The clan credited, whose own videos tab carries it too. Returned for the
   * same reason as the other two: that page is cached, so an approval it is not
   * told about leaves the tactic out of it for half an hour. */
  clanRegion: string | null;
  clanId: number | null;
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
    .returning({
      tankId: tankVideos.tankId,
      arenaId: tankVideos.arenaId,
      clanRegion: tankVideos.clanRegion,
      clanId: tankVideos.clanId,
      title: tankVideos.title,
    });
  return row ? { ...row, status } : null;
}
