import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// Onslaught (Competitive 7) leaderboard standings, one row per (event, account).
// The in-game leaderboard service only keeps the current season live and drops
// past ones, so a private feeder snapshots every page into this table to build
// the multi-season history the public source never keeps. Keyed by `event_id`,
// so a new season's rows sit alongside the finished seasons rather than wiping
// them. The board endpoint serves any slice as a cheap indexed read
// (`WHERE event_id = $1 ORDER BY rank LIMIT 100`).
export function makeOnslaughtRatingsTable(region: string) {
  return pgTable(
    `${region}_onslaught_ratings`,
    {
      // The season identifier ('comp7', ...), matching a row in the seasons table.
      eventId: text("event_id").notNull(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      // Leaderboard position (1-based), as served by the source.
      rank: integer("rank").notNull(),
      // Score / rating points (the ranking metric, source field `p2`).
      rating: integer("rating").notNull(),
      // Battles played in the mode over the season (source field `p3`).
      battles: integer("battles").notNull(),
      // Raw first metric (source field `p1`), unused by the game client; kept
      // verbatim in case its meaning is needed later.
      p1: integer("p1"),
      // Nickname / clan snapshot at fetch time (the source carries them inline).
      name: text("name").notNull(),
      clanTag: text("clan_tag"),
      clanColor: text("clan_color"),
      // Current nickname / clan, resolved by account_id and materialized by the
      // reconcile job (players rename and change clans, so the recorded snapshot
      // goes stale). Null until first reconciled; the board falls back to the
      // recorded values then.
      currentName: text("current_name"),
      currentClanTag: text("current_clan_tag"),
      currentClanColor: text("current_clan_color"),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.eventId, t.accountId] }),
      // Default board read: WHERE event_id = $1 ORDER BY rank ASC.
      index(`${region}_onslaught_ratings_event_rank_idx`).on(
        t.eventId,
        t.rank.asc(),
      ),
      // The transpose, which the player page asks: every season one account is
      // ranked in. The key's own prefix cannot serve it.
      index(`${region}_onslaught_ratings_account_idx`).on(t.accountId),
    ],
  );
}

export type OnslaughtRatingsTable = ReturnType<typeof makeOnslaughtRatingsTable>;

export const onslaughtRatingsByRegion: Record<Region, OnslaughtRatingsTable> = {
  [Region.EU]: makeOnslaughtRatingsTable(Region.EU),
  [Region.NA]: makeOnslaughtRatingsTable(Region.NA),
  [Region.ASIA]: makeOnslaughtRatingsTable(Region.ASIA),
};

// Per-region season metadata, one row per event. Written by the feeder from the
// event definition plus the leaderboard's rank thresholds (which are per region
// and per season), so the board can label a player's tier (Elite / Master) and
// show the current season's window without recomputing anything.
export function makeOnslaughtSeasonsTable(region: string) {
  return pgTable(`${region}_onslaught_seasons`, {
    eventId: text("event_id").primaryKey(),
    name: text("name").notNull(),
    // The season codename ("Season of the Azure Phoenix") + its rank-art ordinal
    // word ("first"), frozen while the season is current. Null until first
    // stamped by the reconcile.
    codename: text("codename"),
    seasonOrdinal: text("season_ordinal"),
    // The year (chapter) the season belongs to: the client's own `COMP7_MASKOT_ID`
    // ("6") and the name behind it ("Phoenix"). Stamped with the codename, and
    // what makes the ordinal countable: the client's localization pre-lists a
    // year's three seasons from its first day, so the live season is not the last
    // one it names, it is the one after those we already hold for this year.
    yearId: text("year_id"),
    yearName: text("year_name"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    // Position thresholds: top `elitePosition` ranks are Elite, top
    // `masterPosition` are Master (the rest are ranked but untiered).
    elitePosition: integer("elite_position"),
    elitePoints: integer("elite_points"),
    masterPosition: integer("master_position"),
    // Unix seconds of the source's last leaderboard recomputation.
    lastRecalculationTs: bigint("last_recalculation_ts", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type OnslaughtSeasonsTable = ReturnType<typeof makeOnslaughtSeasonsTable>;

export const onslaughtSeasonsByRegion: Record<Region, OnslaughtSeasonsTable> = {
  [Region.EU]: makeOnslaughtSeasonsTable(Region.EU),
  [Region.NA]: makeOnslaughtSeasonsTable(Region.NA),
  [Region.ASIA]: makeOnslaughtSeasonsTable(Region.ASIA),
};

// A player's standing over time, one row per instant it moved. The table above
// keeps a player's latest state, which is what a board renders, and overwrites
// the previous one on every pass. The climb is the part nobody else has: the
// source recomputes its board every five minutes and serves only that instant,
// so a season's shape survives here or nowhere.
//
// Written differentially by the feeder (a pass records the rows whose rank,
// rating or battles differ from the current-state row), so a player who did not
// play between two passes costs nothing.
export function makeOnslaughtRatingHistoryTable(region: string) {
  return pgTable(
    `${region}_onslaught_rating_history`,
    {
      eventId: text("event_id").notNull(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
      rank: integer("rank").notNull(),
      rating: integer("rating").notNull(),
      battles: integer("battles").notNull(),
    },
    (t) => [
      // A player's progression is the key's own prefix: WHERE event_id = $1 AND
      // account_id = $2 ORDER BY captured_at.
      primaryKey({ columns: [t.eventId, t.accountId, t.capturedAt] }),
      // Anything aggregated across players at an instant scans a season slice.
      index(`${region}_onslaught_rating_history_event_time_idx`).on(
        t.eventId,
        t.capturedAt,
      ),
      // One player's climb, when the season is not known up front.
      index(`${region}_onslaught_rating_history_account_idx`).on(
        t.accountId,
        t.capturedAt,
      ),
    ],
  );
}

export type OnslaughtRatingHistoryTable = ReturnType<
  typeof makeOnslaughtRatingHistoryTable
>;

export const onslaughtRatingHistoryByRegion: Record<
  Region,
  OnslaughtRatingHistoryTable
> = {
  [Region.EU]: makeOnslaughtRatingHistoryTable(Region.EU),
  [Region.NA]: makeOnslaughtRatingHistoryTable(Region.NA),
  [Region.ASIA]: makeOnslaughtRatingHistoryTable(Region.ASIA),
};

// The board's own state at each pass: how many players hold a place, and what it
// costs to hold each rank. Written every pass rather than only on a change,
// since a regular cadence is what turns the rows into a curve, and one row per
// pass per season is nothing.
//
// The Champion cutoff has no published points value (the source gives positions
// for both ranks but points only for Legend), so the feeder reads the rating
// sitting at that position and stores it alongside.
export function makeOnslaughtSeasonSnapshotsTable(region: string) {
  return pgTable(
    `${region}_onslaught_season_snapshots`,
    {
      eventId: text("event_id").notNull(),
      capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
      rankedCount: integer("ranked_count").notNull(),
      elitePosition: integer("elite_position"),
      elitePoints: integer("elite_points"),
      masterPosition: integer("master_position"),
      masterPoints: integer("master_points"),
      topRating: integer("top_rating"),
      // The last ranked player's rating: the real price of entry.
      minRating: integer("min_rating"),
      totalBattles: bigint("total_battles", { mode: "number" }),
      lastRecalculationTs: bigint("last_recalculation_ts", { mode: "number" }),
    },
    (t) => [primaryKey({ columns: [t.eventId, t.capturedAt] })],
  );
}

export type OnslaughtSeasonSnapshotsTable = ReturnType<
  typeof makeOnslaughtSeasonSnapshotsTable
>;

export const onslaughtSeasonSnapshotsByRegion: Record<
  Region,
  OnslaughtSeasonSnapshotsTable
> = {
  [Region.EU]: makeOnslaughtSeasonSnapshotsTable(Region.EU),
  [Region.NA]: makeOnslaughtSeasonSnapshotsTable(Region.NA),
  [Region.ASIA]: makeOnslaughtSeasonSnapshotsTable(Region.ASIA),
};

// A ranked player's activity, one row per day they played, per season. The
// history table beside it holds every instant we captured, which is what draws
// a climb but is the wrong shape for a rate: answering "how many battles a day"
// off it means differencing 170,000 rows per season and re-differencing them on
// every read, and the source keeps recomputing, so that cost grows with the
// season rather than being paid once.
//
// So the deltas are folded to a day here, once, by the pass that walks them.
// The numbers are GAINS, not totals: a player enters the board carrying
// everything they played to qualify, and that entry value belongs to no day, so
// it is deliberately absent. Points can be negative (a losing day costs rating),
// which is why the day is kept rather than only a running sum.
export function makeOnslaughtDailyTable(region: string) {
  return pgTable(
    `${region}_onslaught_daily`,
    {
      eventId: text("event_id").notNull(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      // The UTC calendar day. Pinned to UTC rather than to any region's local
      // time, like the servers section's own buckets, so nothing silently
      // depends on the process's timezone.
      day: date("day").notNull(),
      // Battles played that day, summed from the captures' own differences.
      battles: integer("battles").notNull(),
      // Rating points won or lost that day. Signed on purpose.
      points: integer("points").notNull(),
      // How many captures of that day carried a gain. Cadence-dependent (the
      // feeder's interval has changed and will again), so it is raw material
      // for a later read rather than a figure to publish as it stands.
      samples: integer("samples").notNull(),
      // The last capture of that day that moved, which is what "last seen
      // playing" reads. The day alone would answer to within 24 hours.
      lastAt: timestamp("last_at", { withTimezone: true }).notNull(),
      // The player's cumulative season totals at the day's LAST capture, which
      // is not always `lastAt`: that one is the last capture that moved, and a
      // day whose final capture only changed a rank ends on a later instant than
      // the one it last played at. The gains above are what this table is read
      // for, but the absolute value is what makes the entry cost recoverable:
      // on a player's first day here, `battlesTotal` minus `battles` is exactly
      // what they had played when they first appeared on the board. It is also
      // the baseline a partial rebuild differences against, so a rebuild of the
      // last few days agrees with a rebuild of the whole season instead of
      // quietly losing whatever its window cut off.
      battlesTotal: integer("battles_total").notNull(),
      ratingTotal: integer("rating_total").notNull(),
      // Where they stood that day: the best position held during it, and the
      // one held at its last capture. The fold walks the captures anyway, and
      // these are what let the board name the players who LOST their place,
      // since the feeder prunes anyone who has left the board from the
      // standings and the fold is where they are recovered from.
      bestRank: integer("best_rank").notNull(),
      rankEnd: integer("rank_end").notNull(),
    },
    (t) => [
      primaryKey({ columns: [t.eventId, t.accountId, t.day] }),
      // The rebuild replaces one day of a season at a time; the key's own
      // prefix cannot serve that.
      index(`${region}_onslaught_daily_event_day_idx`).on(t.eventId, t.day),
      // One player across every season, which a profile asks and the key's own
      // prefix cannot serve. It is what tells a player page they held a place
      // in a season they are no longer ranked in, since the standings row that
      // would have said so is what the prune removed.
      index(`${region}_onslaught_daily_account_idx`).on(t.accountId, t.day),
    ],
  );
}

export type OnslaughtDailyTable = ReturnType<typeof makeOnslaughtDailyTable>;

export const onslaughtDailyByRegion: Record<Region, OnslaughtDailyTable> = {
  [Region.EU]: makeOnslaughtDailyTable(Region.EU),
  [Region.NA]: makeOnslaughtDailyTable(Region.NA),
  [Region.ASIA]: makeOnslaughtDailyTable(Region.ASIA),
};
