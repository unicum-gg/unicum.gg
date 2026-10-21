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

// A player's ratings over a recent window (24h, 7d, 30d) counting only the
// battles at or above a tier floor (6, 8, 10), one row per (account, window,
// floor). Written by the snapshot path in the same breath as the all-tier
// window columns on `*_players`, from the same per-vehicle diff filtered by
// tier, and read by the hourly pass that materializes the recent boards
// (`*_player_period_ratings`). Its own table rather than nine times five more
// columns on `*_players`: that row is rewritten for every account on every
// snapshot, while only the few hundred thousand accounts a recent board could
// rank ever have a value here.
//
// Only rows that clear the window's battle floor are stored (see
// `TOP_PLAYERS_MIN_BATTLES`), since the table exists for the boards alone; a
// row that falls under it on a later snapshot is deleted then.
export function makePlayerTierWindowRatingsTable(region: string) {
  return pgTable(
    `${region}_player_tier_window_ratings`,
    {
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      // The window's wire value: `24h`, `7d` or `30d`.
      period: text("period").notNull(),
      // The lowest tier counted, a `TierFloor` value.
      minTier: smallint("min_tier").notNull(),
      battles: integer("battles").notNull(),
      wins: integer("wins").notNull(),
      wn7: real("wn7"),
      wn8: real("wn8"),
      wnx: real("wnx"),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.accountId, t.period, t.minTier] }),
      // The hourly pass reads one (window, floor) pool at a time.
      index(`${region}_player_tier_window_ratings_pool_idx`).on(
        t.period,
        t.minTier,
      ),
    ],
  );
}

export type PlayerTierWindowRatingsTable = ReturnType<
  typeof makePlayerTierWindowRatingsTable
>;

export const playerTierWindowRatingsByRegion: Record<
  Region,
  PlayerTierWindowRatingsTable
> = {
  [Region.EU]: makePlayerTierWindowRatingsTable(Region.EU),
  [Region.NA]: makePlayerTierWindowRatingsTable(Region.NA),
  [Region.ASIA]: makePlayerTierWindowRatingsTable(Region.ASIA),
};
