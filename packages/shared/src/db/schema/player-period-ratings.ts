import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// Every account eligible for a recent leaderboard window (24h, 7d, 30d), with
// its ratings over that window and the languages inferred from its clan
// history, one row per (period, tier floor, account). Recomputed hourly by the top-players
// cron. It is the recent twin of `player_ratings`, and exists for the same
// reason: the player board filters by language, the inference is too slow to
// run per request, and `player_ratings` only holds the LIFETIME pool (10k
// battles, top 10k per metric), which says nothing about who is playing well
// this week. Unlike that table every eligible account is stored, languages or
// not, since the unfiltered recent boards read from here too.
export function makePlayerPeriodRatingsTable(region: string) {
  return pgTable(
    `${region}_player_period_ratings`,
    {
      // The window's wire value: `24h`, `7d` or `30d`.
      period: text("period").notNull(),
      // The lowest tier whose battles the ratings count, a `TierFloor` value.
      // Each window is ranked three times (tier 6, 8 and 10 and up), so a
      // low-tier farm cannot carry a recent board.
      minTier: smallint("min_tier").notNull().default(6),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      nickname: text("nickname").notNull(),
      // Battles and wins INSIDE the window, so the board's win rate is the
      // window's own rather than a career figure beside a weekly rating.
      battles: integer("battles").notNull(),
      wins: integer("wins"),
      wn7: real("wn7"),
      wn8: real("wn8"),
      wnx: real("wnx"),
      // Same inference and same semantics as `player_ratings.languages`, but
      // empty for an account with no clan history rather than absent.
      languages: text("languages").array().notNull().default([]),
      // When `languages` was last inferred for this account. The inference
      // reads the whole clan history and is the expensive half of the pass,
      // while a history moves on its own slow schedule, so each tick only
      // re-infers what is missing or older than a day and carries the rest.
      languagesAt: timestamp("languages_at", { withTimezone: true }),
      clanTag: text("clan_tag"),
      clanColor: text("clan_color"),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.period, t.minTier, t.accountId] }),
      index(`${region}_player_period_ratings_languages_idx`).using(
        "gin",
        t.languages,
      ),
      // The unfiltered board is `WHERE period = $1 AND min_tier = $2 ORDER BY
      // <metric> DESC LIMIT 1000`, so each metric gets its ordering.
      index(`${region}_player_period_ratings_wn7_idx`).on(t.period, t.minTier, t.wn7.desc()),
      index(`${region}_player_period_ratings_wn8_idx`).on(t.period, t.minTier, t.wn8.desc()),
      index(`${region}_player_period_ratings_wnx_idx`).on(t.period, t.minTier, t.wnx.desc()),
    ],
  );
}

export type PlayerPeriodRatingsTable = ReturnType<
  typeof makePlayerPeriodRatingsTable
>;

export const playerPeriodRatingsByRegion: Record<
  Region,
  PlayerPeriodRatingsTable
> = {
  [Region.EU]: makePlayerPeriodRatingsTable(Region.EU),
  [Region.NA]: makePlayerPeriodRatingsTable(Region.NA),
  [Region.ASIA]: makePlayerPeriodRatingsTable(Region.ASIA),
};
