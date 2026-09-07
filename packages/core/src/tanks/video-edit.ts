import { eq } from "drizzle-orm";
import {
  BattleFormat,
  BattleResult,
  parseYoutubeUrl,
  storedTeamSize,
  storedTier,
  tankVideos,
  TankVideoStatus,
  user,
  type MapGameMode,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import {
  fetchOembed,
  mapIsConsistent,
  videoSubmissionsEnabled,
  type Oembed,
} from "@unicum.gg/core/tanks/video-checks";
import {
  postModerationCard,
  supersedeModerationCard,
  updateModerationCard,
  type VideoCardContext,
} from "@unicum.gg/core/tanks/video-moderation-card";
import {
  describeVideoChanges,
  type VideoChange,
} from "@unicum.gg/core/tanks/video-changes";

/**
 * Correcting a suggestion that was already sent.
 *
 * A submission used to be a one-way door, which is worst for the one field the
 * form never asks about: the vehicle is implied by the page the dialog was
 * opened from, so opening it from the wrong page filed the battle under the
 * wrong tank with no way back. Nothing here is new policy, it is the same
 * checks the submission ran, applied a second time: an edit that validated less
 * than a submission would be a way around the rules by sending a battle and
 * then fixing it into something the form would have refused.
 *
 * An edit always ends up in front of a moderator. A pending row stays pending
 * and its card is rewritten; a published one goes back to pending, because what
 * was approved is not what the row says any more, and approving is the only
 * thing that publishes.
 */

export enum EditVideoOutcome {
  Saved = "saved",
  /** No row with that id. */
  NotFound = "not_found",
  /** Someone else's submission. Their own is theirs whatever became of it, a
   * rejected one included: the moderator has to say why they turned it down,
   * and the answer to "the timestamp is 40 seconds early" is this form. */
  Forbidden = "forbidden",
  /** The link is not a YouTube video we can embed, or the map does not run the
   * mode it was filed under. */
  InvalidUrl = "invalid_url",
  /** The battle it was corrected into is one we already hold. */
  Duplicate = "duplicate",
  /** YouTube would not tell us what the new video is. */
  Unreachable = "unreachable",
  /** No bot or no channel: nothing could review the correction. */
  Disabled = "disabled",
}

/** Who is doing the editing, and what that lets them touch. */
export type EditActor =
  /** The submitter, on their own row. */
  | { kind: "author"; userId: string }
  /** A moderator, holding a signed link minted by a press in the moderation
   * channel. Their Discord id is recorded on the row. */
  | { kind: "moderator"; discordId: string };

/**
 * The corrected battle, resolved the same way a submission is: the route turns
 * slugs and tags into the ids the row stores, and hands the names along for the
 * card.
 */
export type VideoEdit = {
  id: number;
  region: Region;
  url: string;
  startSeconds?: number | null;
  tankId: number | null;
  tankName: string | null;
  tankSlug: string | null;
  arenaId: string;
  mapName: string;
  mapSlug: string;
  mode: MapGameMode;
  spawnTeam: 1 | 2;
  result: BattleResult;
  format: BattleFormat;
  combinedDamage: number | null;
  teamSize?: number | null;
  tier?: number | null;
  clanRegion?: Region | null;
  clanId?: number | null;
  clanTag?: string | null;
};

/** Where a row is published, which an edit can move. Both sides are returned so
 * the caller drops the cache of the page it left as well as the one it landed
 * on: a video moved off a tank has to disappear from that tank. */
export type VideoPlacement = {
  tankId: number | null;
  arenaId: string | null;
  clanRegion: string | null;
  clanId: number | null;
};

export type EditVideoResult = {
  outcome: EditVideoOutcome;
  before?: VideoPlacement;
  after?: VideoPlacement;
  /** True when the edit took a published video back off the site, so the caller
   * can say so rather than letting the author think it is still up. */
  requeued?: boolean;
};

function placement(row: {
  tankId: number | null;
  arenaId: string | null;
  clanRegion: string | null;
  clanId: number | null;
}): VideoPlacement {
  return {
    tankId: row.tankId,
    arenaId: row.arenaId,
    clanRegion: row.clanRegion,
    clanId: row.clanId,
  };
}

/**
 * Postgres' unique-violation code, which is how the one-row-per-battle index
 * answers an edit that lands on a battle we already hold.
 *
 * Walked down the cause chain rather than read off the error: drizzle wraps a
 * failed query in its own error and hangs the driver's on `cause`, so the flat
 * read matched nothing and a duplicate surfaced as a 500 instead of the 409 the
 * endpoint documents.
 */
function isUniqueViolation(err: unknown): boolean {
  for (let e = err; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

/**
 * Apply a correction, then put the card back in front of a moderator.
 *
 * The card is rewritten in place when we know which message it is, and posted
 * fresh when we do not: rows queued before the message id was recorded, and
 * rows whose card failed to post, still have to be reviewable.
 */
export async function editTankVideo(
  edit: VideoEdit,
  actor: EditActor,
): Promise<EditVideoResult> {
  if (!videoSubmissionsEnabled()) {
    return { outcome: EditVideoOutcome.Disabled };
  }

  const [row] = await db
    .select()
    .from(tankVideos)
    .where(eq(tankVideos.id, edit.id))
    .limit(1);
  if (!row) return { outcome: EditVideoOutcome.NotFound };

  if (actor.kind === "author") {
    if (!row.submittedBy || row.submittedBy !== actor.userId) {
      return { outcome: EditVideoOutcome.Forbidden };
    }
    // A rejected row is theirs to correct, which is the whole point of asking
    // the moderator why: most rejections are a timestamp a few seconds off or a
    // map named wrong, and the answer to those is a correction rather than a
    // second submission. It goes back through the queue like any other edit, so
    // nothing is published by insisting.
  }

  const parsed = parseYoutubeUrl(edit.url);
  if (!parsed) return { outcome: EditVideoOutcome.InvalidUrl };
  const ref = {
    ...parsed,
    startSeconds:
      typeof edit.startSeconds === "number"
        ? edit.startSeconds
        : parsed.startSeconds,
  };

  if (!(await mapIsConsistent(edit.region, edit.arenaId, edit.mode))) {
    return { outcome: EditVideoOutcome.InvalidUrl };
  }

  // Only asked for again when the link changed. A correction is usually about
  // the battle rather than the video, and re-reading a title we already hold
  // would make a YouTube hiccup fail an edit that never touched YouTube.
  let oembed: Oembed = { title: row.title, author_name: row.channelName };
  if (ref.videoId !== row.videoId) {
    const fresh = await fetchOembed(ref.videoId);
    if (!fresh) return { outcome: EditVideoOutcome.Unreachable };
    oembed = { title: fresh.title.trim(), author_name: fresh.author_name.trim() };
  }

  // Back to the queue whenever it was out of it. What a moderator approved is
  // not what the row says any more, and there is no second verdict to inherit.
  // The status it is leaving is kept, not just the fact that it had one: the
  // card says something different about a video coming off the site and about a
  // rejection getting a second look.
  const previousStatus = row.status as TankVideoStatus;
  const requeued = previousStatus !== TankVideoStatus.Pending;

  const updated = await db
    .update(tankVideos)
    .set({
      tankId: edit.tankId,
      videoId: ref.videoId,
      startSeconds: ref.startSeconds,
      title: oembed.title,
      channelName: oembed.author_name,
      arenaId: edit.arenaId,
      mode: edit.mode,
      spawnTeam: edit.spawnTeam,
      result: edit.result,
      format: edit.format,
      // A tactic is not one player's game, so the number goes when the format
      // says it should, exactly as on the way in.
      combinedDamage:
        edit.format === BattleFormat.Random ? edit.combinedDamage : null,
      teamSize: storedTeamSize(edit.format, edit.teamSize),
      tier: storedTier(edit.format, edit.tier),
      clanRegion: edit.clanRegion ?? null,
      clanId: edit.clanId ?? null,
      status: TankVideoStatus.Pending,
      reviewedAt: null,
      reviewedBy: null,
      editedAt: new Date(),
      // Only a third party is worth naming: the author is already `submittedBy`.
      editedBy: actor.kind === "moderator" ? actor.discordId : null,
    })
    .where(eq(tankVideos.id, edit.id))
    .returning({ id: tankVideos.id })
    .catch((err: unknown) => {
      if (isUniqueViolation(err)) return null;
      throw err;
    });
  if (updated === null) return { outcome: EditVideoOutcome.Duplicate };
  // Drizzle answers an empty array, not null, when the update matched nothing:
  // the row was deleted between the read above and this write. Reporting that
  // as saved would revalidate pages and re-card a row that no longer exists.
  if (updated.length === 0) return { outcome: EditVideoOutcome.NotFound };

  // Worked out before the card is rewritten, since the row it compares against
  // is the one we just replaced. Its own failure costs the card its "what
  // moved" lines, never the correction.
  const changes = await describeVideoChanges(edit.region, row, edit, ref).catch(
    (err) => {
      console.error("[tank-videos] change summary failed:", err);
      return [];
    },
  );

  await refreshModerationCard(
    row,
    edit,
    ref,
    oembed,
    changes,
    previousStatus,
  ).catch(
    (err) => console.error("[tank-videos] moderation card update failed:", err),
  );

  return {
    outcome: EditVideoOutcome.Saved,
    before: placement(row),
    after: placement({
      tankId: edit.tankId,
      arenaId: edit.arenaId,
      clanRegion: edit.clanRegion ?? null,
      clanId: edit.clanId ?? null,
    }),
    requeued,
  };
}

/**
 * Put the corrected battle back on its card.
 *
 * Best-effort, like the post on the way in: the correction is stored either
 * way, and failing it because Discord hiccuped would leave the author retyping
 * something the database already holds.
 */
async function refreshModerationCard(
  row: { id: number; submittedBy: string | null; discordMessageId: string | null },
  edit: VideoEdit,
  ref: { videoId: string; startSeconds: number },
  oembed: Oembed,
  changes: VideoChange[],
  /** What the row was before this correction. Anything but `pending` means it
   * had been settled, which decides both whether the card is rewritten or
   * posted afresh and what it says about itself. */
  previousStatus: TankVideoStatus,
): Promise<void> {
  const context: VideoCardContext = {
    tankName: edit.tankName,
    tankSlug: edit.tankSlug,
    mapName: edit.mapName,
    mapSlug: edit.mapSlug,
    region: edit.region,
    mode: edit.mode,
    spawnTeam: edit.spawnTeam,
    result: edit.result,
    format: edit.format,
    combinedDamage:
      edit.format === BattleFormat.Random ? edit.combinedDamage : null,
    teamSize: edit.teamSize ?? null,
    tier: edit.tier ?? null,
    clanTag: edit.clanTag ?? null,
    // The card names who is waiting on the review, which is the submitter and
    // not whoever corrected it.
    submitterName: await submitterName(row.submittedBy),
    changes,
    previousStatus,
  };

  // A row that was already settled has to come back to the surface. Discord
  // does not resurface an edited message, so rewriting the old card in place
  // would leave the correction buried under everything posted since, on a card
  // whose buttons someone already pressed. A pending row is the opposite case:
  // its card is still in the queue being looked at, so it is rewritten where it
  // stands rather than posted twice.
  if (previousStatus !== TankVideoStatus.Pending) {
    const messageId = await postModerationCard(row.id, ref, oembed, context);
    if (messageId) {
      await db
        .update(tankVideos)
        .set({ discordMessageId: messageId })
        .where(eq(tankVideos.id, row.id));
      // The old card is left readable but inert, so the channel's history does
      // not carry two live cards for one row.
      if (row.discordMessageId) {
        await supersedeModerationCard(row.discordMessageId).catch(() => {});
      }
    }
    return;
  }

  if (row.discordMessageId) {
    const done = await updateModerationCard(
      row.discordMessageId,
      row.id,
      ref,
      oembed,
      context,
    );
    if (done) return;
  }

  // No message to rewrite, or the rewrite failed (deleted, purged): a fresh
  // card, so the correction is still reviewable.
  const messageId = await postModerationCard(row.id, ref, oembed, context);
  if (messageId) {
    await db
      .update(tankVideos)
      .set({ discordMessageId: messageId })
      .where(eq(tankVideos.id, row.id));
  }
}

/** The account the row was submitted under. Falls back to a plain word rather
 * than a blank field: the row survives its user being deleted. */
async function submitterName(userId: string | null): Promise<string> {
  if (!userId) return "unknown";
  const [row] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.name ?? "unknown";
}
