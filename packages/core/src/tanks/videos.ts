import { and, eq } from "drizzle-orm";
import {
  BattleFormat,
  BattleResult,
  parseYoutubeUrl,
  storedTeamSize,
  storedTier,
  tankVideos,
  TankVideoStatus,
  type MapGameMode,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import {
  postModerationCard,
  VIDEO_REVIEW_PREFIX,
} from "@unicum.gg/core/tanks/video-moderation-card";
import {
  currentGameVersion,
  fetchOembed,
  mapIsConsistent,
  videoSubmissionsEnabled,
} from "@unicum.gg/core/tanks/video-checks";

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

export { VIDEO_REVIEW_PREFIX, videoSubmissionsEnabled };
export type { Oembed } from "@unicum.gg/core/tanks/video-checks";

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
      teamSize: storedTeamSize(submission.format, submission.teamSize),
      tier: storedTier(submission.format, submission.tier),
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
  const messageId = await postModerationCard(
    row.id,
    ref,
    oembed,
    submission,
  ).catch((err) => {
    console.error("[tank-videos] moderation card failed:", err);
    return null;
  });
  // Kept so a correction rewrites this card rather than posting a second one.
  // Written after the insert rather than in it, because the card cannot be
  // posted before the row it carries the id of exists.
  if (messageId) {
    await db
      .update(tankVideos)
      .set({ discordMessageId: messageId })
      .where(eq(tankVideos.id, row.id));
  }

  return { outcome: SubmitVideoOutcome.Queued, videoId: ref.videoId };
}

export type ReviewedVideo = {
  /** The submitter, so the caller can tell them what was decided, and the video
   * itself, so the notice can show what it is about. */
  submittedBy: string | null;
  videoId: string;
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
  /** Why it was turned down, in the moderator's words. Stored on a rejection
   * only: an approval that carried one would be a note about a video that is
   * live, which nothing reads. */
  note?: string | null,
): Promise<ReviewedVideo | null> {
  const status = approved
    ? TankVideoStatus.Approved
    : TankVideoStatus.Rejected;
  const [row] = await db
    .update(tankVideos)
    .set({
      status,
      reviewedAt: new Date(),
      reviewedBy: moderatorId,
      reviewNote: approved ? null : (note?.trim() || null),
    })
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
      submittedBy: tankVideos.submittedBy,
      videoId: tankVideos.videoId,
    });
  return row ? { ...row, status } : null;
}
