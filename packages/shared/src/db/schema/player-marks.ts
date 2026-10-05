import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * How many Marks of Excellence a player holds, by level and by tier: one row
 * per account, written the moment we read their marks.
 *
 * It is denormalised rather than counted on the read path because the marks
 * themselves live in `*_tank_snapshots`, and a count per player needs the
 * LATEST snapshot of every vehicle they own, which is a walk of the largest
 * table we have. The one job licensed to make that walk (`top-players-by-tank`)
 * is not usable here either: it filters `battles >= 100`, and a mark is earned
 * on a rolling window of recent battles rather than on a career, so the floor
 * drops about a fifth of the three-mark guns on a garage and drops them
 * UNEVENLY by tier (measured on EU: 10% at tier X, 35% at tier XI, over half at
 * tier V). A board whose whole subject is the per-tier split cannot be built on
 * a per-tier bias.
 *
 * So the writer is the portal refresh instead. `fetchPlayerMarksOnGun` already
 * returns every vehicle the player has fought a battle in, with no floor of any
 * kind, and it is the only moment a mark can move in our data, so counting
 * there is both free and exact: the board agrees with the profile page by
 * construction.
 *
 * What that costs is coverage, and it is a property of the data rather than of
 * this table. Marks come from the WoT portal at ~1 request/second/region, so
 * they are only read on an on-demand (page-view) refresh: about 19% of EU
 * accounts over a thousand battles carry any, and a player nobody has ever
 * looked up is absent here rather than present with a zero. Every surface says
 * so instead of implying a complete ranking.
 */
export function makePlayerMarksTable(region: string) {
  return pgTable(
    `${region}_player_marks`,
    {
      accountId: bigint("account_id", { mode: "number" }).primaryKey(),
      // Vehicles at each mark level, by tier: index `i` holds tier `i + 1`
      // (`markCountAtTier` is the reader). An array rather than a column per
      // tier because the tiers are Wargaming's to extend, as tier XI already
      // showed, and 33 columns would make that a migration instead of a longer
      // array.
      marks1ByTier: integer("marks_1_by_tier").array().notNull().default([]),
      marks2ByTier: integer("marks_2_by_tier").array().notNull().default([]),
      marks3ByTier: integer("marks_3_by_tier").array().notNull().default([]),
      // The same tallies summed, stored rather than derived: the board's whole
      // ordering is `ORDER BY marks_3_total DESC`, and summing an array per row
      // to sort 40,000 of them is the one read this table exists to avoid.
      marks1Total: integer("marks_1_total").notNull().default(0),
      marks2Total: integer("marks_2_total").notNull().default(0),
      marks3Total: integer("marks_3_total").notNull().default(0),
      // Vehicles the portal reported a mark level for, which is this row's own
      // denominator: it separates "no marks" from "a garage we have only partly
      // read", the same role `observed` plays for the activity series.
      known: integer("known").notNull().default(0),
      // The account's lifetime battles when the marks were read.
      //
      // Denormalised for the board's own predicate, the way `*_player_ratings`
      // carries `battles` and `winrate` so its board needs no join back. It is
      // the one filter every query here applies, and left on the players table
      // it forces a join of the WHOLE ranked set before anything can be sorted,
      // which is what a tier column does: it has no index to read an order off,
      // so it sorts. Local, the sort is over this small table and the join is
      // the thousand rows that survive the limit.
      //
      // The DISPLAYED battle count still comes from the players row, so the
      // board shows the current figure. This one only decides eligibility, and
      // a floor of a thousand battles does not care that it was read last week.
      battles: integer("battles").notNull().default(0),
      // Inferred from the account's clan history, exactly as the by-language
      // player board infers it, so one account cannot be French on one board
      // and German on another. Filled by the hourly pass rather than at write
      // time: a clan stint moves on its own schedule, with nothing to do with
      // whether a mark was earned. Empty for an account we hold no history for.
      languages: text("languages").array().notNull().default([]),
      // The newest observation these counts were taken from, not when the row
      // was written.
      //
      // Exact for the live writer: it stamps the moment the portal answered,
      // and a mark cannot move in our data without that answer. For a row the
      // backfill seeded it is an UPPER BOUND, because the bulk snapshot
      // pipeline carries the last known marks forward onto newer snapshots
      // without re-reading them, and nothing in the stored rows tells a
      // carried value apart from a re-confirmed one. Said rather than papered
      // over: every account refreshed from here on gets the exact stamp, so the
      // bound decays out of the table on its own.
      measuredAt: timestamp("measured_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      // The board's ordering. Partial, because a row with no three-mark gun is
      // never on it and two thirds of the table are exactly that.
      index(`${region}_player_marks_3_total_idx`)
        .on(t.marks3Total.desc())
        .where(sql`${t.marks3Total} > 0`),
      // The language filter's own predicate, as on `player_ratings`: GIN serves
      // the `$lang = ANY(languages)` containment.
      index(`${region}_player_marks_languages_idx`).using("gin", t.languages),
    ],
  );
}

export type PlayerMarksTable = ReturnType<typeof makePlayerMarksTable>;
export type PlayerMarksRow = PlayerMarksTable["$inferSelect"];
export type NewPlayerMarks = PlayerMarksTable["$inferInsert"];

export const playerMarksByRegion: Record<Region, PlayerMarksTable> = {
  [Region.EU]: makePlayerMarksTable(Region.EU),
  [Region.NA]: makePlayerMarksTable(Region.NA),
  [Region.ASIA]: makePlayerMarksTable(Region.ASIA),
};
