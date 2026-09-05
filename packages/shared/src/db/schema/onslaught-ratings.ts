import {
  bigint,
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
