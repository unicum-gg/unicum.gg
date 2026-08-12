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

/**
 * The format a battle was played in.
 *
 * Deliberately not `BattleType`, which answers a different question: that one
 * says which formats a *map* can host, and its values are the ones the client
 * scripts distinguish by arena. Advances, skirmishes, Maneuvers and tournaments
 * are all played on the random map pool, so no arena carries them, and only the
 * person who recorded the battle knows which one it was.
 *
 * This is the axis a tactic is looked up by. Everything except `Random` is a
 * competitive format, where the video is about a map and a side rather than
 * about the vehicle someone happened to be in.
 */
export enum BattleFormat {
  Random = "random",
  ClanWars = "clan_wars",
  Advances = "advances",
  Skirmish = "skirmish",
  Maneuvers = "maneuvers",
  Onslaught = "onslaught",
  Tournament = "tournament",
}

export const BATTLE_FORMAT_LABEL: Record<BattleFormat, string> = {
  [BattleFormat.Random]: "Random",
  [BattleFormat.ClanWars]: "Clan Wars",
  [BattleFormat.Advances]: "Advances",
  [BattleFormat.Skirmish]: "Skirmish",
  [BattleFormat.Maneuvers]: "Maneuvers",
  [BattleFormat.Onslaught]: "Onslaught",
  [BattleFormat.Tournament]: "Tournament",
};

/** A battle played for a clan rather than for oneself: the video is a tactic,
 * and it belongs to the map it was played on. */
export function isCompetitiveFormat(format: BattleFormat): boolean {
  return format !== BattleFormat.Random;
}

/**
 * The team size and tier a format fixes, where it fixes them.
 *
 * Clan Wars and Advances are tier X fifteens and Onslaught a tier X seven, so
 * asking would be asking someone to retype a rule. Skirmishes, Maneuvers and
 * tournaments run at several sizes and tiers, so there the submitter is the
 * only source and the fields are theirs to fill.
 */
export const FORMAT_TEAM_SIZE: Partial<Record<BattleFormat, number>> = {
  [BattleFormat.Random]: 15,
  [BattleFormat.ClanWars]: 15,
  [BattleFormat.Advances]: 15,
  [BattleFormat.Onslaught]: 7,
};

export const FORMAT_TIER: Partial<Record<BattleFormat, number>> = {
  [BattleFormat.ClanWars]: 10,
  [BattleFormat.Advances]: 10,
  [BattleFormat.Onslaught]: 10,
};

export const tankVideos = pgTable(
  "tank_videos",
  {
    id: serial("id").primaryKey(),
    /** Wargaming's tank id, the same value on every region. Null on a
     * competitive tactic, which is about a map and a side: the vehicle the
     * camera happens to sit in is not what anyone looks it up by. Set whenever
     * it is known, so the tank's own page can still show the battle. */
    tankId: integer("tank_id"),
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
    /** `BattleFormat` value. `random` for everything submitted before tactics
     * existed, which is what those rows were. */
    format: text("format").notNull().default(BattleFormat.Random),
    /** Players per team, and the tier it was fought at. Only stored where the
     * format does not fix them (a skirmish, Maneuvers, a tournament): reading
     * them back goes through the format first, so a Clan Wars row does not
     * depend on someone having typed 15 and X correctly. */
    teamSize: smallint("team_size"),
    tier: smallint("tier"),
    /** The clan the battle was played for, as a region and a WG clan id rather
     * than a tag: tags are renamed, ids are not, so the credit survives it the
     * same way a tank's name is resolved from its id. Null when the submitter
     * claims no clan. */
    clanRegion: text("clan_region"),
    clanId: integer("clan_id"),
    /** Damage dealt plus assisted, as the game's own after-battle screen adds
     * them up. Declared like the rest of the battle context and just as
     * unverifiable, so it is what a moderator checks against the video's last
     * seconds. Null when the submitter left it out: a good battle is worth
     * linking whether or not anyone remembers the number. */
    combinedDamage: integer("combined_damage"),
    /** When YouTube says the video went up, read off the watch page at
     * submission and stored: it never changes, and it is what tells a reader a
     * tactic is from last season. Null when the page did not answer. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
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
    //
    // Built `NULLS NOT DISTINCT` in migration 0068, which this builder cannot
    // express: a tactic carries no tank, and under the default rule two null
    // tank ids never collide, so the guard would quietly stop covering exactly
    // the rows that have no second key to fall back on. The migrations here are
    // hand-written and applied by hand (see AGENTS.md), so the declaration
    // below only has to name the index, not reproduce it.
    uniqueIndex("tank_videos_battle_idx").on(
      t.tankId,
      t.videoId,
      t.startSeconds,
    ),
    // The tab's own read: this tank's approved videos.
    index("tank_videos_tank_status_idx").on(t.tankId, t.status),
    // The map page's read: this arena's approved tactics.
    index("tank_videos_arena_status_idx").on(t.arenaId, t.status),
    // The moderation queue, oldest first.
    index("tank_videos_status_submitted_idx").on(t.status, t.submittedAt),
  ],
);

export type TankVideoRow = typeof tankVideos.$inferSelect;
export type NewTankVideoRow = typeof tankVideos.$inferInsert;
