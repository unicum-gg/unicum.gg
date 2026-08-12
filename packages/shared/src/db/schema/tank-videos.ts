import {
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Community-suggested gameplay videos, one row per *battle*, not per video.
 *
 * A creator's stream VOD runs for hours and covers twenty tanks, so what has
 * value is the deep link into the minute this tank is played. That is why the
 * row carries `startSeconds` and why the same `videoId` legitimately appears
 * several times: once per tank it covers, and more than once for a tank when
 * the VOD holds two battles in it.
 *
 * Global, not per region, unlike `vehicles`: the catalogue is region-scoped
 * because servers ship different tanks, but a video of the IS-7 is a video of
 * the IS-7 on all three. A suggestion made on EU shows up on NA and Asia.
 *
 * Everything below `channelName` is declared by the submitter and unverifiable
 * from here, which is what the moderation queue is for: a wrong map is worse
 * than no map, because it silently breaks the filter it feeds.
 */

/** Where a submission stands. Rejected rows are kept, not deleted: the unique
 * index below is what stops the same battle being queued again after a no. */
export enum TankVideoStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

/** Outcome of the battle, as declared by the submitter. */
export enum BattleResult {
  Victory = "victory",
  Defeat = "defeat",
  Draw = "draw",
}

/**
 * What a reader sees, next to the values a column holds.
 *
 * Written out rather than left to a `capitalize` class, because a select clones
 * the chosen option's content into its trigger and not its styling, so the CSS
 * silently stopped applying there and the field read "victory".
 */
export const BATTLE_RESULT_LABEL: Record<BattleResult, string> = {
  [BattleResult.Victory]: "Victory",
  [BattleResult.Defeat]: "Defeat",
  [BattleResult.Draw]: "Draw",
};

export const tankVideos = pgTable(
  "tank_videos",
  {
    id: serial("id").primaryKey(),
    /** Wargaming's tank id, the same value on every region. */
    tankId: integer("tank_id").notNull(),
    /** YouTube's 11-character id, never a raw URL: the page embeds this, so it
     * is parsed and validated before it is ever stored. */
    videoId: text("video_id").notNull(),
    /** Where the battle starts in the video. 0 when the link had no timestamp. */
    startSeconds: integer("start_seconds").notNull().default(0),

    // Read from YouTube's oEmbed at submission time, so the moderation embed
    // shows the video rather than a bare id, and the grid needs no per-render
    // call to YouTube.
    title: text("title").notNull(),
    channelName: text("channel_name").notNull(),

    /** Arena id from our own map catalogue (`@unicum.gg/core/wargaming/wot/maps`),
     * so the tab can filter by map. Null when the map was not identified. */
    arenaId: text("arena_id"),
    /** `MapGameMode` value: the form only offers the modes that map supports. */
    mode: text("mode"),
    /** Which side the player spawned on, 1 or 2, matching the arena's own team
     * numbering. The readable direction ("North") is derived from the map's
     * spawn geometry rather than declared, so it cannot contradict the map. */
    spawnTeam: smallint("spawn_team"),
    /** `BattleResult` value. */
    result: text("result"),
    /** Damage dealt plus assisted, as the game's own after-battle screen adds
     * them up. Declared like the rest of the battle context and just as
     * unverifiable, so it is what a moderator checks against the video's last
     * seconds. Null when the submitter left it out: a good battle is worth
     * linking whether or not anyone remembers the number. */
    combinedDamage: integer("combined_damage"),
    /** Game version at approval time, stamped from the client scripts mirror.
     * Balance moves between patches, so a reader can see a video is two patches
     * old without us asking the submitter for something they would guess. */
    gameVersion: text("game_version"),

    /** `TankVideoStatus` value. */
    status: text("status").notNull().default(TankVideoStatus.Pending),
    /** Submitting account. Sign-in is required, so this is only null once that
     * user is deleted, which must not take the video down with it. */
    submittedBy: text("submitted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Discord id of the moderator who pressed the button. */
    reviewedBy: text("reviewed_by"),
  },
  (t) => [
    // One row per battle. Same video for another tank, or the same tank at
    // another minute, are different rows; the same battle twice is not.
    uniqueIndex("tank_videos_battle_idx").on(
      t.tankId,
      t.videoId,
      t.startSeconds,
    ),
    // The tab's own read: this tank's approved videos.
    index("tank_videos_tank_status_idx").on(t.tankId, t.status),
    // The moderation queue, oldest first.
    index("tank_videos_status_submitted_idx").on(t.status, t.submittedAt),
  ],
);

export type TankVideoRow = typeof tankVideos.$inferSelect;
export type NewTankVideoRow = typeof tankVideos.$inferInsert;
