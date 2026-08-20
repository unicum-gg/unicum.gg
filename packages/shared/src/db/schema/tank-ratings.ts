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

/**
 * What players think of a vehicle, one row per account and per tank.
 *
 * Global rather than per region, for the same reason the videos are: a tank is
 * the same tank on all three servers, so an opinion formed on EU is an opinion
 * about the IS-7. The voter's region is still stored, because their record is
 * region-scoped and that is where the proof of experience is read from.
 *
 * The row is what makes this different from every other community average out
 * there: alongside the stars it carries the voter's own record on that exact
 * vehicle, snapshotted at the moment they voted. That is what lets the average
 * be split by how well the person rating it actually plays it, and what makes
 * a vote answerable, since the sample it rests on is shown next to it.
 *
 * A vote is edited, never accumulated: the unique index below is on (tank,
 * user), and a second submission overwrites the first.
 */

/** How well a voter plays, at the moment they voted, so the tank page can show
 * who the average is coming from. Cut on account WN8 along the same boundaries
 * `wn8Color` uses, so the brackets and the colours the site already paints
 * cannot drift apart. `Unknown` is a real answer: an account we have not
 * snapshotted deeply enough has no rating, and pretending it is average would
 * quietly move every split. */
export enum VoterBracket {
  Unknown = "unknown",
  /** Below 900 WN8: still learning the game. */
  Learning = "learning",
  /** 900 to 1600: the bulk of the population. */
  Average = "average",
  /** 1600 to 2350: knows what it is doing. */
  Strong = "strong",
  /** 2350 and above. */
  Unicum = "unicum",
}

export const VOTER_BRACKET_LABEL: Record<VoterBracket, string> = {
  [VoterBracket.Unknown]: "Unrated",
  [VoterBracket.Learning]: "Learning",
  [VoterBracket.Average]: "Average",
  [VoterBracket.Strong]: "Strong",
  [VoterBracket.Unicum]: "Unicum",
};

/** The order they are shown in, worst to best, which is also the order the
 * split is read in. `Unknown` sits last: it is a gap in what we know, not a
 * rung on the ladder. */
export const VOTER_BRACKETS: VoterBracket[] = [
  VoterBracket.Learning,
  VoterBracket.Average,
  VoterBracket.Strong,
  VoterBracket.Unicum,
  VoterBracket.Unknown,
];

/** Which bracket an account WN8 falls in. Null in, `Unknown` out. */
export function voterBracket(wn8: number | null | undefined): VoterBracket {
  if (wn8 == null || !Number.isFinite(wn8)) return VoterBracket.Unknown;
  if (wn8 < 900) return VoterBracket.Learning;
  if (wn8 < 1600) return VoterBracket.Average;
  if (wn8 < 2350) return VoterBracket.Strong;
  return VoterBracket.Unicum;
}

/**
 * Where a written opinion stands.
 *
 * Separate from the vote it rides on: the stars are counted the moment they are
 * cast, the sentence next to them is published only once a moderator has read
 * it. `None` is the common case, a vote with nothing written.
 */
export enum TankReviewStatus {
  None = "none",
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

/** Where a written opinion ended up, so the caller can say something true about
 * it rather than inferring from the request. */
export enum ReviewOutcome {
  /** No text on this vote. */
  None = "none",
  /** New or changed text, now waiting on a moderator. */
  Queued = "queued",
  /** Unchanged text that was already published. */
  Published = "published",
  /** Unchanged text still waiting from an earlier submission. */
  Pending = "pending",
  /** Unchanged text a moderator turned down. It stays down. */
  Rejected = "rejected",
  /** Text was sent while written opinions are closed, so it was not kept. */
  Closed = "closed",
}

/**
 * The axes a vehicle is rated on, all on the same five-step scale.
 *
 * Two tiers, deliberately. `Overall` and `Fun` are the quick vote, two taps,
 * and they are what the community average is built from: an average is only
 * worth reading if enough people cast it, so the thing everyone is asked for
 * has to cost nothing. The seven below are optional and open on request, which
 * is what feeds the per-tank radar without taxing the person who just wanted to
 * say the tank is good.
 */
export enum TankRatingAxis {
  Overall = "overall",
  Fun = "fun",
  Firepower = "firepower",
  Armour = "armour",
  Mobility = "mobility",
  GunHandling = "gunHandling",
  Concealment = "concealment",
  BeginnerFriendliness = "beginnerFriendliness",
  Versatility = "versatility",
}

/** Asked of everyone, in two taps. */
export const QUICK_AXES: TankRatingAxis[] = [
  TankRatingAxis.Overall,
  TankRatingAxis.Fun,
];

/** Opened on request, and the ones the radar is drawn from. */
export const DETAIL_AXES: TankRatingAxis[] = [
  TankRatingAxis.Firepower,
  TankRatingAxis.Armour,
  TankRatingAxis.Mobility,
  TankRatingAxis.GunHandling,
  TankRatingAxis.Concealment,
  TankRatingAxis.BeginnerFriendliness,
  TankRatingAxis.Versatility,
];

export const TANK_RATING_AXIS_LABEL: Record<TankRatingAxis, string> = {
  [TankRatingAxis.Overall]: "Overall",
  [TankRatingAxis.Fun]: "Fun",
  [TankRatingAxis.Firepower]: "Firepower",
  [TankRatingAxis.Armour]: "Armour",
  [TankRatingAxis.Mobility]: "Mobility",
  [TankRatingAxis.GunHandling]: "Gun handling",
  [TankRatingAxis.Concealment]: "Concealment",
  [TankRatingAxis.BeginnerFriendliness]: "Beginner friendly",
  [TankRatingAxis.Versatility]: "Versatility",
};

/**
 * The same axes, short enough to sit around a radar.
 *
 * The full labels overflow the ring and get clipped at the sides, which turned
 * "Beginner friendly" into "endly". Shortening beats widening the chart: the
 * polygon is the thing being read, and growing the canvas to fit two words of
 * text shrinks it on every phone.
 */
export const TANK_RATING_AXIS_SHORT: Record<TankRatingAxis, string> = {
  [TankRatingAxis.Overall]: "Overall",
  [TankRatingAxis.Fun]: "Fun",
  [TankRatingAxis.Firepower]: "Firepower",
  [TankRatingAxis.Armour]: "Armour",
  [TankRatingAxis.Mobility]: "Mobility",
  [TankRatingAxis.GunHandling]: "Handling",
  [TankRatingAxis.Concealment]: "Camo",
  [TankRatingAxis.BeginnerFriendliness]: "Beginner",
  [TankRatingAxis.Versatility]: "Versatile",
};

/** What each axis is asking, shown under its stars so two people rating the
 * same tank are answering the same question. */
export const TANK_RATING_AXIS_HINT: Record<TankRatingAxis, string> = {
  [TankRatingAxis.Overall]: "How good is this tank, all things considered?",
  [TankRatingAxis.Fun]: "How much do you enjoy playing it?",
  [TankRatingAxis.Firepower]: "Alpha, damage per minute and penetration.",
  [TankRatingAxis.Armour]: "How much it bounces, hull down and in the open.",
  [TankRatingAxis.Mobility]: "Speed, acceleration and how it turns.",
  [TankRatingAxis.GunHandling]: "Aim time, dispersion and accuracy on the move.",
  [TankRatingAxis.Concealment]: "Camouflage and view range.",
  [TankRatingAxis.BeginnerFriendliness]:
    "How forgiving it is if you are still learning.",
  [TankRatingAxis.Versatility]: "Does it work on any map, in any team?",
};

/** The scale, both ends of it. Five steps, half-steps are not stored: an
 * opinion given in halves is an opinion nobody agrees on the meaning of. */
export const MIN_STARS = 1;
export const MAX_STARS = 5;

/**
 * Battles on the tank before an account may rate it.
 *
 * The whole point of the gate. Every other community average takes votes from
 * people who have never taken the vehicle out, which is how a tank that is
 * miserable to play against ends up rated as if it were miserable to play. We
 * can check, because the voter signs in with Wargaming and we hold their record
 * on that exact tank, so we do.
 *
 * Set where an opinion starts being worth something rather than where it
 * becomes expert: twenty-five battles is a few evenings, and pushing it higher
 * buys accuracy the bracket split already gives us at the cost of the volume
 * the average needs.
 */
export const MIN_BATTLES_TO_RATE = 25;

/** A written opinion's bounds. Long enough for a real verdict, short enough
 * that the tank page stays a page of opinions rather than one essay. */
export const MIN_REVIEW_LENGTH = 80;
export const MAX_REVIEW_LENGTH = 900;

export const tankRatings = pgTable(
  "tank_ratings",
  {
    id: serial("id").primaryKey(),
    /** Wargaming's tank id, the same value on every region. */
    tankId: integer("tank_id").notNull(),
    /** The voter. Cascades on delete, unlike a suggested video: a video is a
     * contribution to a library and outlives the account that found it, an
     * opinion is the person, and it goes when they do. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** Where the voter plays, so their record can be read back from the right
     * region's tables, and so the average can be split by server. */
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
    firepower: smallint("firepower"),
    armour: smallint("armour"),
    mobility: smallint("mobility"),
    gunHandling: smallint("gun_handling"),
    concealment: smallint("concealment"),
    beginnerFriendliness: smallint("beginner_friendliness"),
    versatility: smallint("versatility"),

    // What the voter had actually done on this tank when they voted, copied off
    // their newest snapshot. Stored rather than joined at read time on purpose:
    // it is what the opinion rested on, so it must not drift afterwards, and it
    // turns the bracket split into a group-by on this table instead of a fan-out
    // across three regional schemas.
    battles: integer("battles").notNull(),
    winrate: real("winrate"),
    avgDamage: real("avg_damage"),
    /** The voter's WN8 on this tank, not on their account. */
    tankWn8: real("tank_wn8"),
    marksOnGun: smallint("marks_on_gun"),
    markOfMastery: smallint("mark_of_mastery"),

    // The voter themselves, same snapshot rule. This is what the bracket is cut
    // on, and what makes "unicums rate it 4.6, everyone else 3.1" a query
    // rather than a research project.
    playerWn8: real("player_wn8"),
    playerBattles: integer("player_battles"),
    /** `VoterBracket` value, derived from `playerWn8` at write time so the
     * split needs no CASE over a nullable float on every read. */
    bracket: text("bracket").notNull().default(VoterBracket.Unknown),

    /** Client version the vote was cast under, stamped rather than asked for.
     * A tank is buffed and nerfed, and an opinion of it is an opinion of the
     * version it was played in: this is what lets the page draw the rating
     * against the changes it already tracks, and what an ageing vote is
     * discounted by. */
    gameVersion: text("game_version"),

    /** The written opinion, when there is one. Published only after review,
     * which is what `reviewStatus` gates. */
    review: text("review"),
    /** `TankReviewStatus` value. `none` when the vote carries no text. */
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
    // One opinion per account per tank. Editing replaces, so this is the
    // conflict target the submission upserts against.
    uniqueIndex("tank_ratings_tank_user_idx").on(t.tankId, t.userId),
    // The tank page's own read: this vehicle's votes, grouped and split.
    index("tank_ratings_tank_idx").on(t.tankId),
    // The same read, cut by bracket, which is the split the page leads with.
    index("tank_ratings_tank_bracket_idx").on(t.tankId, t.bracket),
    // The moderation queue, oldest first.
    index("tank_ratings_review_status_idx").on(t.reviewStatus, t.createdAt),
    // A reader's own ratings, for their profile and for the garage prompts.
    index("tank_ratings_user_idx").on(t.userId),
  ],
);

export type TankRatingRow = typeof tankRatings.$inferSelect;
export type NewTankRatingRow = typeof tankRatings.$inferInsert;

/**
 * The per-tank rollup the list pages read, recomputed on a cron.
 *
 * The tank page does not use it: one vehicle's votes are an indexed group-by
 * that also has to produce a histogram, a bracket split and seven axis means,
 * and doing that live keeps the page honest the second a vote lands. The
 * catalogue pages are the opposite problem, eleven hundred vehicles at once
 * behind an ISR render, which is what this table exists for.
 *
 * `hype` is the column nothing else on the internet has: what players think of
 * a tank minus what the tank actually does, both as percentiles inside its own
 * tier, so the overrated and underrated boards are one ORDER BY.
 */
export const tankRatingAggregates = pgTable(
  "tank_rating_aggregates",
  {
    tankId: integer("tank_id").primaryKey(),
    votes: integer("votes").notNull().default(0),
    /** Votes carrying a published written opinion. */
    reviews: integer("reviews").notNull().default(0),

    /** The plain means, which is what a reader expects a five-star average to
     * be, and what every other site shows. */
    overallAvg: real("overall_avg"),
    funAvg: real("fun_avg"),
    /** The means the boards are ranked on: shrunk towards the site-wide mean by
     * a fixed prior, so a vehicle with four votes cannot sit above one with
     * four hundred. A plain mean sorted descending is a list of tanks nobody
     * has rated yet. */
    overallBayes: real("overall_bayes"),
    funBayes: real("fun_bayes"),
    /** How much the voters disagree. High is the interesting case, and it gets
     * said out loud on the page rather than averaged away. */
    overallStddev: real("overall_stddev"),

    /** Where the community's verdict sits among the tanks of the same tier,
     * 0 to 1, and where the tank's measured win rate sits among the same set.
     * Comparing across tiers would be comparing a tier II to a tier X. */
    perceivedPercentile: real("perceived_percentile"),
    measuredPercentile: real("measured_percentile"),
    /** `perceivedPercentile - measuredPercentile`. Positive means the community
     * rates it above what it does, negative below. */
    hype: real("hype"),

    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The two boards: best rated, and most over/underrated.
    index("tank_rating_aggregates_overall_idx").on(t.overallBayes),
    index("tank_rating_aggregates_hype_idx").on(t.hype),
  ],
);

export type TankRatingAggregateRow = typeof tankRatingAggregates.$inferSelect;
export type NewTankRatingAggregateRow =
  typeof tankRatingAggregates.$inferInsert;
