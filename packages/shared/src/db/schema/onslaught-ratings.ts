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
    // The season codename ("Season of the Jade Dragon") + its rank-art ordinal
    // word ("third"), frozen when the season is current (the client only names
    // the latest season). Null until first stamped by the reconcile.
    codename: text("codename"),
    seasonOrdinal: text("season_ordinal"),
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
