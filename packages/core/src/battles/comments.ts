import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  APP_IDENTITY,
  BattleCommentStatus,
  battleComments,
  battlesByRegion,
  BRAND_COLOR_INT,
  env,
  MAX_BATTLE_COMMENT_LENGTH,
  MIN_BATTLE_COMMENT_LENGTH,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { postChannelEmbedWithComponents } from "@unicum.gg/core/discord";
import { reviewDigest, reviewDigestMatches } from "@unicum.gg/core/community/review-digest";
import { ReviewDecision } from "@unicum.gg/core/community/review-decision";
import {
  quoteBack,
  REJECTED_COLOR,
  sendAuthorNotice,
} from "@unicum.gg/core/community/author-notice";

/**
 * Comments under a battle's replay.
 *
 * Moderated before anybody but their author sees them, through the queue the
 * vehicle and map reviews already go through: the same Discord channel, the
 * same digest guard, the same bot handler, routed on the card's own prefix. A
 * published comment can be taken down afterwards from the very card that
 * published it, or by its author.
 */

/** The custom-id prefix of a battle comment's moderation card. */
export const BATTLE_COMMENT_REVIEW_PREFIX = "battlecomment";

/** One comment as a reader is shown it. */
export type BattleComment = {
  id: number;
  nickname: string;
  accountId: number;
  authorRegion: string;
  body: string;
  createdAt: Date;
  status: BattleCommentStatus;
  /** Whether the author fought in this battle, which the page says beside the
   * name: a comment from somebody who was there reads differently. */
  inBattle: boolean;
};

const columns = {
  id: battleComments.id,
  nickname: battleComments.nickname,
  accountId: battleComments.accountId,
  authorRegion: battleComments.authorRegion,
  body: battleComments.body,
  createdAt: battleComments.createdAt,
  status: battleComments.status,
};

/** The accounts a battle names, to mark the comments of those who fought it. */
async function playersOf(region: Region, arenaUniqueId: string): Promise<Set<number>> {
  const table = battlesByRegion[region];
  const [row] = await db
    .select({ players: table.playerIds })
    .from(table)
    .where(eq(table.arenaUniqueId, arenaUniqueId))
    .limit(1);
  return new Set((row?.players ?? []).map(Number));
}

/**
 * A battle's comments: every published one, oldest first like a conversation,
 * plus the reader's own that are still waiting or were turned down, which only
 * they are shown.
 */
export async function battleCommentsOf(
  region: Region,
  arenaUniqueId: string,
  readerId: string | null,
): Promise<BattleComment[]> {
  const visible = readerId
    ? sql`(${battleComments.status} = ${BattleCommentStatus.Approved}
          OR (${battleComments.userId} = ${readerId}
              AND ${battleComments.status} IN (${BattleCommentStatus.Pending}, ${BattleCommentStatus.Rejected})))`
    : eq(battleComments.status, BattleCommentStatus.Approved);
  const [rows, players] = await Promise.all([
    db
      .select(columns)
      .from(battleComments)
      .where(
        and(
          eq(battleComments.region, region),
          eq(battleComments.arenaUniqueId, arenaUniqueId),
          visible,
        ),
      )
      .orderBy(asc(battleComments.createdAt)),
    playersOf(region, arenaUniqueId),
  ]);
  return rows.map((row) => ({
    ...row,
    status: row.status as BattleCommentStatus,
    inBattle: row.authorRegion === region && players.has(row.accountId),
  }));
}

/** How many published comments each of these battles holds, for a list. */
export async function battleCommentCounts(
  region: Region,
  arenaUniqueIds: string[],
): Promise<Map<string, number>> {
  if (arenaUniqueIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: battleComments.arenaUniqueId,
      count: sql<number>`count(*)::int`,
    })
    .from(battleComments)
    .where(
      and(
        eq(battleComments.region, region),
        inArray(battleComments.arenaUniqueId, arenaUniqueIds),
        eq(battleComments.status, BattleCommentStatus.Approved),
      ),
    )
    .groupBy(battleComments.arenaUniqueId);
  return new Map(rows.map((row) => [row.id, row.count]));
}

export enum SubmitBattleCommentOutcome {
  Queued = "queued",
  Length = "length",
  UnknownBattle = "unknown_battle",
}

/** Write a comment down and put it in front of a moderator. */
export async function submitBattleComment(input: {
  region: Region;
  arenaUniqueId: string;
  userId: string;
  authorRegion: Region;
  accountId: number;
  nickname: string;
  body: string;
}): Promise<{ outcome: SubmitBattleCommentOutcome; id?: number }> {
  const body = input.body.trim();
  if (
    body.length < MIN_BATTLE_COMMENT_LENGTH ||
    body.length > MAX_BATTLE_COMMENT_LENGTH
  ) {
    return { outcome: SubmitBattleCommentOutcome.Length };
  }
  const table = battlesByRegion[input.region];
  const [battle] = await db
    .select({ map: table.mapName })
    .from(table)
    .where(eq(table.arenaUniqueId, input.arenaUniqueId))
    .limit(1);
  if (!battle) return { outcome: SubmitBattleCommentOutcome.UnknownBattle };

  const [row] = await db
    .insert(battleComments)
    .values({
      region: input.region,
      arenaUniqueId: input.arenaUniqueId,
      userId: input.userId,
      authorRegion: input.authorRegion,
      accountId: input.accountId,
      nickname: input.nickname,
      body,
    })
    .returning({ id: battleComments.id });

  // After the row, never before: a card for a comment that failed to save would
  // be a button that publishes nothing.
  await postCommentCard({
    id: row.id,
    digest: reviewDigest(body),
    region: input.region,
    arenaUniqueId: input.arenaUniqueId,
    map: battle.map,
    nickname: input.nickname,
    body,
  }).catch((err) => console.error("[battle-comments] card not posted:", err));
  return { outcome: SubmitBattleCommentOutcome.Queued, id: row.id };
}

/** The battle's own page, which a card and a notice both link to. */
function battlePageUrl(region: string, arenaUniqueId: string): string {
  return `${APP_IDENTITY.URL}/${region}/battles/${arenaUniqueId}?tab=replay`;
}

async function postCommentCard(card: {
  id: number;
  digest: string;
  region: Region;
  arenaUniqueId: string;
  map: string;
  nickname: string;
  body: string;
}): Promise<void> {
  if (!env.DISCORD_REVIEW_CHANNEL_ID) return;
  const button = (style: number, label: string, action: string) => ({
    type: 2,
    style,
    label,
    custom_id: `${BATTLE_COMMENT_REVIEW_PREFIX}:${action}:${card.id}:${card.digest}`,
  });
  await postChannelEmbedWithComponents(
    env.DISCORD_REVIEW_CHANNEL_ID,
    {
      title: `${card.nickname} on a battle (${card.map})`,
      url: battlePageUrl(card.region, card.arenaUniqueId),
      description: card.body,
      color: BRAND_COLOR_INT,
      footer: {
        text: `${APP_IDENTITY.NAME} · a comment under a battle replay, hidden until published`,
      },
    },
    [
      {
        type: 1,
        components: [
          button(3, "Publish", "approve"),
          button(4, "Reject", "reject"),
        ],
      },
    ],
  );
}

/** What a moderator can do from the card. */
export enum BattleCommentAction {
  Approve = "approve",
  Reject = "reject",
  /** Take down a comment already published. */
  Remove = "remove",
}

/**
 * Settle a comment from its card.
 *
 * Publishing and rejecting only touch a comment still waiting, and removing
 * only one already published, each guarded by the digest of the text the card
 * showed, so a press never acts on prose the moderator did not read.
 */
export async function reviewBattleComment(
  id: number,
  action: BattleCommentAction,
  moderatorId: string,
  digest: string,
): Promise<{
  decision: ReviewDecision;
  region?: string;
  arenaUniqueId?: string;
  userId?: string;
  body?: string;
}> {
  const from =
    action === BattleCommentAction.Remove
      ? BattleCommentStatus.Approved
      : BattleCommentStatus.Pending;
  const to =
    action === BattleCommentAction.Approve
      ? BattleCommentStatus.Approved
      : action === BattleCommentAction.Reject
        ? BattleCommentStatus.Rejected
        : BattleCommentStatus.Removed;
  const [row] = await db
    .update(battleComments)
    .set({ status: to, reviewedAt: new Date(), reviewedBy: moderatorId })
    .where(
      and(
        eq(battleComments.id, id),
        eq(battleComments.status, from),
        reviewDigestMatches(battleComments.body, digest),
      ),
    )
    .returning({
      region: battleComments.region,
      arenaUniqueId: battleComments.arenaUniqueId,
      userId: battleComments.userId,
      body: battleComments.body,
    });
  if (row) {
    // Told only of the first decision. A removal later is a moderator taking
    // something down, which the page itself shows.
    if (action !== BattleCommentAction.Remove) {
      await notifyAuthor(row, action === BattleCommentAction.Approve);
    }
    return { decision: ReviewDecision.Settled, ...row };
  }
  // A comment's text never changes after it is written, so a digest mismatch
  // is not a rewrite: whatever the state, somebody settled it first.
  return { decision: ReviewDecision.AlreadyReviewed };
}

async function notifyAuthor(
  comment: { region: string; arenaUniqueId: string; userId: string; body: string },
  approved: boolean,
): Promise<void> {
  const url = battlePageUrl(comment.region, comment.arenaUniqueId);
  await sendAuthorNotice({
    userId: comment.userId,
    scope: "battle-comments",
    embed: approved
      ? {
          title: "Your comment is published",
          url,
          description: quoteBack(comment.body),
          color: BRAND_COLOR_INT,
        }
      : {
          title: "Your comment was not published",
          url,
          description: `${quoteBack(comment.body)}\n\nYou can write another one under the battle.`,
          color: REJECTED_COLOR,
        },
  });
}

/** An author taking down their own comment, waiting or published. */
export async function removeOwnBattleComment(
  id: number,
  userId: string,
): Promise<{ region: string; arenaUniqueId: string } | null> {
  const [row] = await db
    .update(battleComments)
    .set({
      status: BattleCommentStatus.Removed,
      reviewedAt: new Date(),
      reviewedBy: "author",
    })
    .where(
      and(
        eq(battleComments.id, id),
        eq(battleComments.userId, userId),
        inArray(battleComments.status, [
          BattleCommentStatus.Pending,
          BattleCommentStatus.Approved,
        ]),
      ),
    )
    .returning({
      region: battleComments.region,
      arenaUniqueId: battleComments.arenaUniqueId,
    });
  return row ?? null;
}
