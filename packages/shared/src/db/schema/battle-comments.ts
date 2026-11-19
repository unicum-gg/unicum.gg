import {
  bigint,
  index,
  serial,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Where a battle comment stands. Only `approved` is ever shown to readers. */
export enum BattleCommentStatus {
  /** Written, waiting on a moderator. Shown to its author alone. */
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
  /** Taken down after it was published, by a moderator or by its author. */
  Removed = "removed",
}

/** Shorter than this says nothing a reader can use. */
export const MIN_BATTLE_COMMENT_LENGTH = 2;
/** A comment on a battle, not an essay: the tank reviews' own ceiling. */
export const MAX_BATTLE_COMMENT_LENGTH = 900;

/**
 * What players wrote under a battle's replay.
 *
 * Moderated like the vehicle and map reviews and through the same Discord
 * queue: nothing is shown to anybody but its author until a moderator has read
 * it, and a published comment can still be taken down afterwards, by the
 * moderator from the same card or by its author. Unlike those reviews it is a
 * discussion rather than an opinion, so an account may write as many as it
 * likes under one battle, each its own row, and each is signed with the
 * author's name: a comment on somebody's battle is a conversation, and a
 * conversation needs to know who is talking.
 *
 * One global table rather than one per region, like the rating tables: a
 * battle is addressed by its region and its id together, and a comment is far
 * too rare for that to be worth three tables.
 */
export const battleComments = pgTable(
  "battle_comments",
  {
    id: serial("id").primaryKey(),
    /** The battle's region and its game id, which is its page. */
    region: text("region").notNull(),
    arenaUniqueId: text("arena_unique_id").notNull(),
    /** The author. Cascades on delete: a comment is the person, like an
     * opinion, and goes with the account. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The author's Wargaming account, `eu-500000000`'s two halves. */
    authorRegion: text("author_region").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    /** Denormalised so a comment is signed without a regional join; a rename
     * afterwards leaves the name it was written under. */
    nickname: text("nickname").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default(BattleCommentStatus.Pending),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** The moderator's Discord id, or `author` when they took it down. */
    reviewedBy: text("reviewed_by"),
  },
  (t) => [
    index("battle_comments_battle_idx").on(t.region, t.arenaUniqueId, t.status),
    index("battle_comments_user_idx").on(t.userId),
  ],
);

export type BattleCommentRow = typeof battleComments.$inferSelect;
