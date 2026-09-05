import { bigint, integer, jsonb, pgTable, smallint, timestamp } from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import type {
  DistributionBucket,
  TierShare,
  TypeShare,
} from "../../wot/player-distribution";

/**
 * How the region's players are spread across win rate and WNX, and how its
 * battles are spread across tiers and vehicle types. ONE singleton row per
 * region (`id = 1`), like the coverage trends beside it.
 *
 * Materialised rather than read live for the reason that table already
 * documents: the histograms are a full scan of `*_players` (2.1M rows, 2.3 GB
 * on EU, ~380ms), which is affordable once an hour in the background and not on
 * a page that three regions revalidate at once after a deploy. The tier and
 * type breakdowns are cheap enough to read live (they aggregate the ~1000-row
 * `*_tank_stats` in ~46ms), but they belong to the same answer and are stored
 * with it so the page reads one row instead of one row plus a join.
 *
 * The buckets are stored with their own edges rather than as bare counts, so
 * the reader never has to reconstruct them from constants that may since have
 * moved: a row written under an older range still draws correctly, and the
 * percentile maths reads the edges it was actually built with.
 */
export function makePlayerDistributionTable(region: string) {
  return pgTable(`${region}_player_distribution`, {
    // Pins the table to a single row per region.
    id: smallint("id").primaryKey().default(1),
    // The battle threshold the histograms were built with, carried so the page
    // can name the population it describes.
    minBattles: integer("min_battles").notNull(),
    players: bigint("players", { mode: "number" }).notNull(),
    winrate: jsonb("winrate").$type<DistributionBucket[]>().notNull(),
    // One column per rating metric rather than one blob, so a metric can be
    // added or its range changed without rewriting the others.
    wn7: jsonb("wn7").$type<DistributionBucket[]>().notNull(),
    wn8: jsonb("wn8").$type<DistributionBucket[]>().notNull(),
    wnx: jsonb("wnx").$type<DistributionBucket[]>().notNull(),
    byTier: jsonb("by_tier").$type<TierShare[]>().notNull(),
    byType: jsonb("by_type").$type<TypeShare[]>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type PlayerDistributionTable = ReturnType<
  typeof makePlayerDistributionTable
>;

export const playerDistributionByRegion: Record<
  Region,
  PlayerDistributionTable
> = {
  [Region.EU]: makePlayerDistributionTable(Region.EU),
  [Region.NA]: makePlayerDistributionTable(Region.NA),
  [Region.ASIA]: makePlayerDistributionTable(Region.ASIA),
};
