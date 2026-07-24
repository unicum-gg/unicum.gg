import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// Materialized stronghold leaderboard, one row per (tier, period, clan). Holds
// every clan that qualifies for the board (min battles + active in the last 30
// days), with all metrics precomputed, so the endpoint serves any (tier, sort,
// period) slice as a cheap indexed read (`WHERE tier = $1 AND period = $2 ORDER
// BY <sort> LIMIT 100`) instead of re-running the ~3s snapshots x members
// aggregation on every request. Recomputed hourly by the top-clans cron.
export function makeStrongholdRatingsTable(region: string) {
  return pgTable(
    `${region}_stronghold_ratings`,
    {
      // 'advances' | 't10' | 't8' | 't6' (StrongholdTier).
      tier: text("tier").notNull(),
      // 'overall' | '30d' (StrongholdPeriod). Battles/wins/sr are already the
      // period's values (all-time totals, or the 30-day diff).
      period: text("period").notNull(),
      clanId: bigint("clan_id", { mode: "number" }).notNull(),
      tag: text("tag").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull(),
      emblem: text("emblem"),
      // Declared languages of the clan (from `clans.languages`), carried so the
      // row renders like the live query did (the board itself does not filter).
      languages: text("languages").array().notNull().default([]),
      membersCount: integer("members_count").notNull(),
      // Skirmish ELO for the tier (Advances shares Skirmish T10's ELO); null for
      // tiers/periods where WG exposes none.
      elo: integer("elo"),
      // Battles / wins over the period (all-time, or the 30-day diff).
      battles: integer("battles").notNull(),
      wins: integer("wins").notNull(),
      // Median WG Personal Rating of the roster; null when unknown.
      personalRating: integer("personal_rating"),
      // Share of the roster reading as boost accounts (0..1); null when unknown.
      boostRatio: numeric("boost_ratio"),
      // Composite skirmish rating (roster x win rate x volume x maturity).
      sr: numeric("sr"),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.tier, t.period, t.clanId] }),
      // Default board read: WHERE tier = $1 AND period = $2 ORDER BY sr DESC.
      // Other sorts (elo/battles/win rate) filter on the same prefix, then sort
      // the small filtered slice.
      index(`${region}_stronghold_ratings_tp_sr_idx`).on(
        t.tier,
        t.period,
        t.sr.desc(),
      ),
    ],
  );
}

export type StrongholdRatingsTable = ReturnType<
  typeof makeStrongholdRatingsTable
>;

export const strongholdRatingsByRegion: Record<Region, StrongholdRatingsTable> =
  {
    [Region.EU]: makeStrongholdRatingsTable(Region.EU),
    [Region.NA]: makeStrongholdRatingsTable(Region.NA),
    [Region.ASIA]: makeStrongholdRatingsTable(Region.ASIA),
  };
