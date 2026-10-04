import {
  bigint,
  index,
  integer,
  pgTable,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { TankReviewStatus, VoterBracket } from "./tank-ratings";

/**
 * What players think of a map, one row per account and per arena.
 *
 * The same machinery as `tank_ratings`, deliberately: the stored vocabulary
 * (`VoterBracket`, `TankReviewStatus`), the five-step scale, the review bounds
 * and the shrinkage prior are imported from there rather than restated, because
 * a second copy of a formula or a status ladder only has to drift once. What is
 * genuinely different is two things, and only two: the axes a map is judged on,
 * and the evidence a vote is signed with.
 *
 * Global rather than per region, like the tank votes and for the same reason:
 * an arena is the same arena on all three servers, so an opinion formed on EU
 * is an opinion about Prokhorovka. The voter's region is still stored, because
 * their record is region-scoped and the average is worth splitting by server.
 *
 * Keyed on the arena id, never on the slug. The slug is derived from the
 * English name and a map Wargaming renames keeps its arena id, which is the
 * same rule the change history and the video library already key on.
 *
 * A vote is edited, never accumulated: the unique index below is on (arena,
 * user), and a second submission overwrites the first.
 */

/**
 * The axes a map is judged on, all on the same five-step scale as the vehicles.
 *
 * Two tiers for the same reason: `Overall` and `Fun` are the quick vote, two
 * taps, and they are what the community average is built from, so the thing
 * everyone is asked for has to cost nothing. The five below are optional and
 * open on request.
 *
 * None of them is a vehicle axis reworded. A map has no firepower, and asking
 * about its armour would get five answers about whatever tank the voter last
 * drove. These are the questions a map actually settles: whether the two sides
 * start equal, whether there is more than one way to play it, whether the
 * battle moves, whether every class has somewhere to be, and whether it is
 * forgiving to someone still learning the game.
 */
export enum MapRatingAxis {
  Overall = "overall",
  Fun = "fun",
  /** Do both sides start with an equal chance? */
  Balance = "balance",
  /** Is there more than one way to play it, or one road everybody takes? */
  Variety = "variety",
  /** Does the battle move, or stall into a standoff? */
  Flow = "flow",
  /** Does every vehicle class have a job here? */
  ClassFairness = "classFairness",
  /** How forgiving is it if you are still learning? */
  BeginnerFriendliness = "beginnerFriendliness",
}

/** Asked of everyone, in two taps. */
export const MAP_QUICK_AXES: MapRatingAxis[] = [
  MapRatingAxis.Overall,
  MapRatingAxis.Fun,
];

/** Opened on request, and the ones the radar is drawn from. */
export const MAP_DETAIL_AXES: MapRatingAxis[] = [
  MapRatingAxis.Balance,
  MapRatingAxis.Variety,
  MapRatingAxis.Flow,
  MapRatingAxis.ClassFairness,
  MapRatingAxis.BeginnerFriendliness,
];

export const MAP_RATING_AXIS_LABEL: Record<MapRatingAxis, string> = {
  [MapRatingAxis.Overall]: "Overall",
  [MapRatingAxis.Fun]: "Fun",
  [MapRatingAxis.Balance]: "Balance",
  [MapRatingAxis.Variety]: "Variety",
  [MapRatingAxis.Flow]: "Flow",
  [MapRatingAxis.ClassFairness]: "Class fairness",
  [MapRatingAxis.BeginnerFriendliness]: "Beginner friendly",
};

/**
 * The same axes, short enough to sit around a radar.
 *
 * Shortened rather than the canvas widened, the lesson the vehicle radar
 * already paid for: the polygon is the thing being read, and growing the chart
 * to fit two words of label shrinks it on every phone.
 */
export const MAP_RATING_AXIS_SHORT: Record<MapRatingAxis, string> = {
  [MapRatingAxis.Overall]: "Overall",
  [MapRatingAxis.Fun]: "Fun",
  [MapRatingAxis.Balance]: "Balance",
  [MapRatingAxis.Variety]: "Variety",
  [MapRatingAxis.Flow]: "Flow",
  [MapRatingAxis.ClassFairness]: "Classes",
  [MapRatingAxis.BeginnerFriendliness]: "Beginner",
};

/** What each axis is asking, shown under its stars so two people rating the
 * same map are answering the same question. */
export const MAP_RATING_AXIS_HINT: Record<MapRatingAxis, string> = {
  [MapRatingAxis.Overall]: "How good is this map, all things considered?",
  [MapRatingAxis.Fun]: "How much do you enjoy being sent here?",
  [MapRatingAxis.Balance]: "Do both sides start with an equal chance?",
  [MapRatingAxis.Variety]:
    "Is there more than one way to play it, or one road everybody takes?",
  [MapRatingAxis.Flow]: "Does the battle move, or stall into a standoff?",
  [MapRatingAxis.ClassFairness]: "Does every vehicle class have a job here?",
  [MapRatingAxis.BeginnerFriendliness]:
    "How forgiving is it if you are still learning?",
};

/**
 * Battles on the account before it may rate a map.
 *
 * The vehicle gate reads the voter's record on that exact tank, which is what
 * makes its average worth more than a poll of whoever showed up. There is no
 * such reading for a map: Wargaming publishes no per-arena record, for anyone,
 * so nothing anywhere can prove a given account has played Prokhorovka.
 *
 * What a map has instead is the rotation. Nobody picks where they are sent, so
 * exposure follows from playing the game at all rather than from owning
 * anything, and an account's own battle count is the honest proxy the vehicle
 * gate cannot borrow. Set at a thousand because the random pool is around fifty
 * arenas: that is roughly twenty passages through each, which is where "has
 * seen this map" stops being an assumption. Said out loud on the refusal
 * screen, because a gate whose reason is guessed at reads as an arbitrary wall.
 *
 * The consequence is deliberate and worth stating rather than hiding: a map
 * only in a low-tier pool, or an Onslaught variant, is rated behind a gate that
 * cannot tell whether this particular voter has been there. The bracket split
 * is what carries the weight the per-tank evidence carries on a vehicle.
 */
export const MAP_MIN_BATTLES_TO_RATE = 1000;

export const mapRatings = pgTable(
  "map_ratings",
  {
    id: serial("id").primaryKey(),
    /**
     * The client's own arena id (`10_hills`, `100_thepit`), which is the same
     * value on every region and survives a rename. Text rather than an integer
     * because that is what the arena definitions carry and what the change
     * history and the video library are already keyed on.
     */
    arenaId: text("arena_id").notNull(),
    /** The voter. Cascades on delete, like a vehicle rating and unlike a
     * suggested video: a video is a contribution to a library and outlives the
     * account that found it, an opinion is the person. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** Where the voter plays, so their record can be read from the right
     * region's tables and the average can be split by server. */
    region: text("region").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    /** Denormalised so a review can be signed without joining three regional
     * tables. Refreshed whenever the vote is edited, since nicknames change. */
    nickname: text("nickname").notNull(),

    // The quick vote. Both required: a vote is a pair, and letting one side be
    // skipped would silently change what each average is over.
    overall: smallint("overall").notNull(),
    fun: smallint("fun").notNull(),

    // The optional detail. All or nothing at the form's level, but nullable
    // here per axis, so an axis added later needs no backfill and reads as
    // "not answered" on every existing row.
    balance: smallint("balance"),
    variety: smallint("variety"),
    flow: smallint("flow"),
    classFairness: smallint("class_fairness"),
    beginnerFriendliness: smallint("beginner_friendliness"),

    // What the voter had actually done when they voted, copied off their player
    // row. Stored rather than joined at read time for the same reason the
    // vehicle votes store theirs: it is what the opinion rested on, so it must
    // not drift afterwards, and it turns the bracket split into a group-by on
    // this table instead of a fan-out across three regional schemas.
    //
    // Account-level throughout, which is the whole difference from a vehicle
    // vote: there is no per-arena record to sign with.
    playerWn8: real("player_wn8"),
    playerBattles: integer("player_battles"),
    playerWinrate: real("player_winrate"),
    /**
     * Battles in the voter's trailing 30 days.
     *
     * The one honest answer to "is this an opinion about the map as it is
     * now". A map is reworked between updates and the lifetime count cannot
     * tell a verdict formed last week from one formed in 2016, where the
     * vehicle votes get that for free from the client version plus a per-tank
     * battle count that moves.
     */
    playerRecentBattles: integer("player_recent_battles"),
    /** `VoterBracket` value, derived from `playerWn8` at write time so the
     * split needs no CASE over a nullable float on every read. */
    bracket: text("bracket").notNull().default(VoterBracket.Unknown),

    /** Client version the vote was cast under, stamped rather than asked for. A
     * map is reworked, and an opinion of it is an opinion of the layout that
     * was live: this is what lets the page draw the verdict against the changes
     * it already tracks. */
    gameVersion: text("game_version"),

    /** The written opinion, when there is one. Published only after review,
     * which is what `reviewStatus` gates. */
    review: text("review"),
    /** `TankReviewStatus` value, the same ladder the vehicle reviews walk,
     * since it is the same queue and the same moderator. `none` when the vote
     * carries no text. */
    reviewStatus: text("review_status").notNull().default(TankReviewStatus.None),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Discord id of the moderator who pressed the button. */
    reviewedBy: text("reviewed_by"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One opinion per account per arena. Editing replaces, so this is the
    // conflict target the submission upserts against.
    uniqueIndex("map_ratings_arena_user_idx").on(t.arenaId, t.userId),
    // The map page's own read: this arena's votes, grouped and split.
    index("map_ratings_arena_idx").on(t.arenaId),
    // The same read, cut by bracket, which is the split the page leads with.
    index("map_ratings_arena_bracket_idx").on(t.arenaId, t.bracket),
    // The moderation queue, oldest first.
    index("map_ratings_review_status_idx").on(t.reviewStatus, t.createdAt),
    // A reader's own ratings, for their profile and for the prompts that ask
    // them about the maps they have not judged yet.
    index("map_ratings_user_idx").on(t.userId),
  ],
);

export type MapRatingRow = typeof mapRatings.$inferSelect;
export type NewMapRatingRow = typeof mapRatings.$inferInsert;

/**
 * The per-map rollup the gallery and the board read, recomputed on a cron.
 *
 * The map page does not use it, for the same reason the tank page does not use
 * its twin: one arena's votes are an indexed group-by that also has to produce
 * two histograms, a bracket split and five axis means, and doing that live is
 * what keeps the page honest the second a vote lands. The lists are the
 * opposite problem, the whole catalogue at once behind an ISR render.
 *
 * Deliberately shorter than the vehicle rollup by two columns. There is no
 * `hype` here and there cannot be: that column is the community's rank inside
 * a tier minus the tank's measured win-rate rank inside the same tier, and a
 * map has neither a tier nor a measured result of its own. Win rate by arena is
 * not something Wargaming publishes or we could ever accumulate, so there is
 * nothing on the other side of the subtraction. A column that would always be
 * null is worse than an absent one: it reads as a feature waiting on data.
 */
export const mapRatingAggregates = pgTable(
  "map_rating_aggregates",
  {
    arenaId: text("arena_id").primaryKey(),
    votes: integer("votes").notNull().default(0),
    /** Votes carrying a published written opinion. */
    reviews: integer("reviews").notNull().default(0),

    /** The plain means, which is what a reader expects a five-star average to
     * be, and what every other site shows. */
    overallAvg: real("overall_avg"),
    funAvg: real("fun_avg"),
    /** The means the board is ranked on: shrunk towards the site-wide mean by
     * the same fixed prior the vehicles use, so a map with four votes cannot
     * sit above one with four hundred. A plain mean sorted descending is a list
     * of the arenas nobody has rated yet. */
    overallBayes: real("overall_bayes"),
    funBayes: real("fun_bayes"),
    /** How much the voters disagree. High is the interesting case on a map even
     * more than on a tank, and it gets said out loud on the page rather than
     * averaged away. */
    overallStddev: real("overall_stddev"),

    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The board: best rated first.
    index("map_rating_aggregates_overall_idx").on(t.overallBayes),
  ],
);

export type MapRatingAggregateRow = typeof mapRatingAggregates.$inferSelect;
export type NewMapRatingAggregateRow = typeof mapRatingAggregates.$inferInsert;
