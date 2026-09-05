import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import type { RatingMetric } from "../../constants/rating";
import type { RatingColor } from "../../wot/ratings";

/**
 * What each band of the region's players wins at each tier: one row per
 * (metric, band, tier), so about three hundred per region.
 *
 * Written by the nightly `top-players-by-tank` cron rather than by a pass of
 * its own. A win rate per tier only exists in `*_tank_snapshots` (360 million
 * rows and 85 GB on EU), the table nothing is allowed to scan for a page, and
 * that cron already streams it end to end with the player row joined on. So the
 * grid is accumulated in the pass that was happening anyway and costs it three
 * more columns in the SELECT, instead of a second walk of the largest table we
 * have.
 *
 * The two counters are stored and the win rate is derived at read, so a cell
 * can be re-summed (a tier across bands, a band across tiers) rather than being
 * an average of averages.
 */
export function makeTierWinrateTable(region: string) {
  return pgTable(
    `${region}_tier_winrate`,
    {
      // The rating scale the band belongs to. All three are stored, like the
      // histograms beside them, so the navbar's metric selector switches the
      // grid without anything being recomputed.
      metric: text("metric").$type<RatingMetric>().notNull(),
      band: text("band").$type<RatingColor>().notNull(),
      // The band's edges as the colour function drew them when the row was
      // written, half-open (`from` included, `to` excluded) and null at the
      // scale's two open ends. Stored for the reason the distribution buckets
      // store theirs: which players landed in this row was decided at write
      // time, so a threshold that moves later must not relabel a row it never
      // measured. Nullable also for rows written before these columns existed.
      bandFrom: integer("band_from"),
      bandTo: integer("band_to"),
      tier: smallint("tier").notNull(),
      // The per-vehicle battle floor the pass applied, carried so the page can
      // name the population it draws rather than assume today's constant.
      minBattles: integer("min_battles").notNull(),
      players: integer("players").notNull(),
      battles: bigint("battles", { mode: "number" }).notNull(),
      wins: bigint("wins", { mode: "number" }).notNull(),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.metric, t.band, t.tier] })],
  );
}

export type TierWinrateTable = ReturnType<typeof makeTierWinrateTable>;
export type NewTierWinrate = TierWinrateTable["$inferInsert"];

export const tierWinrateByRegion: Record<Region, TierWinrateTable> = {
  [Region.EU]: makeTierWinrateTable(Region.EU),
  [Region.NA]: makeTierWinrateTable(Region.NA),
  [Region.ASIA]: makeTierWinrateTable(Region.ASIA),
};
