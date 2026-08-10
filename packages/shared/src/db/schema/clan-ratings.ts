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

// Materialized per-clan battle-weighted ratings, one row per (clan, metric).
// Recomputed hourly by the top-clans cron from the same clan_members x players
// scan that powers the global leaderboard, so the by-language boards become a
// cheap indexed read (filter on `languages`, order by `avg_value`) instead of
// re-running the ~8s aggregation per (language, metric) on every request.
export function makeClanRatingsTable(region: string) {
  return pgTable(
    `${region}_clan_ratings`,
    {
      // 'wn7' | 'wn8' | 'wnx' — the rating this row's avg_value/rated count is
      // for. A clan has one row per metric it has rated members for.
      metric: text("metric").notNull(),
      clanId: bigint("clan_id", { mode: "number" }).notNull(),
      tag: text("tag").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull(),
      emblem: text("emblem"),
      // Declared languages of the clan (from `clans.languages`). The by-language
      // board filters `$lang = ANY(languages)`; strict = `languages = ARRAY[$lang]`.
      languages: text("languages").array().notNull().default([]),
      // Declared member count (from `clans.members_count`).
      membersCount: integer("members_count").notNull(),
      // Members with a non-null value for THIS metric (the population the average
      // is battle-weighted over). Boards floor this to reject dormant/troll clans.
      ratedMembersCount: integer("rated_members_count").notNull(),
      avgValue: numeric("avg_value").notNull(),
      // Position on this metric's board, written by the cron that already knows
      // the ordering. Ranking at read time costs a full sort of the board
      // (measured 410 ms for one clan on EU), which the badges would pay again
      // for every row of a leaderboard. Null until the next cron run.
      rank: integer("rank"),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.metric, t.clanId] }),
      // Ordered board reads: WHERE metric = $1 ... ORDER BY avg_value DESC.
      index(`${region}_clan_ratings_metric_avg_idx`).on(
        t.metric,
        t.avgValue.desc(),
      ),
    ],
  );
}

export type ClanRatingsTable = ReturnType<typeof makeClanRatingsTable>;

export const clanRatingsByRegion: Record<Region, ClanRatingsTable> = {
  [Region.EU]: makeClanRatingsTable(Region.EU),
  [Region.NA]: makeClanRatingsTable(Region.NA),
  [Region.ASIA]: makeClanRatingsTable(Region.ASIA),
};
