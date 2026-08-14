import {
  bigint,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// Materialized language-inferred ratings for the top players of a region, one
// row per account (only accounts with at least one inferred language, since
// this table is read exclusively by the by-language board). Recomputed hourly
// by the top-players cron: it pays the ~5s two-phase inference (top candidates
// per metric x clan-history language scoring) once in the background so the
// by-language board is a cheap indexed read (filter on `languages`, order by
// the metric column) instead of re-running the CTE per (language, metric).
export function makePlayerRatingsTable(region: string) {
  return pgTable(
    `${region}_player_ratings`,
    {
      accountId: bigint("account_id", { mode: "number" }).primaryKey(),
      nickname: text("nickname").notNull(),
      battles: integer("battles").notNull(),
      // Lifetime win rate (0..1), carried so the by-language board can show a
      // win-rate column without a join back to the players table.
      winrate: real("winrate"),
      wn7: real("wn7"),
      wn8: real("wn8"),
      wnx: real("wnx"),
      // Inferred from the account's clan history (time-weighted language
      // scores). Always non-empty for stored rows. Board filters
      // `$lang = ANY(languages)`; strict = `languages = ARRAY[$lang]`.
      languages: text("languages").array().notNull().default([]),
      clanTag: text("clan_tag"),
      clanColor: text("clan_color"),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      // The board's selective predicate is the language filter; GIN serves the
      // `$lang = ANY(languages)` (= `languages @> ARRAY[$lang]`) containment.
      index(`${region}_player_ratings_languages_idx`)
        .using("gin", t.languages),
    ],
  );
}

export type PlayerRatingsTable = ReturnType<typeof makePlayerRatingsTable>;

export const playerRatingsByRegion: Record<Region, PlayerRatingsTable> = {
  [Region.EU]: makePlayerRatingsTable(Region.EU),
  [Region.NA]: makePlayerRatingsTable(Region.NA),
  [Region.ASIA]: makePlayerRatingsTable(Region.ASIA),
};
