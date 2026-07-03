import {
  bigint,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@/services/wargaming/wot";

export function makeTopClansTable(region: string) {
  return pgTable(
    `${region}_top_clans`,
    {
      // 'wn7' | 'wn8' | 'wnx' — the rating used to rank this row.
      metric: text("metric").notNull(),
      rank: integer("rank").notNull(),
      clanId: bigint("clan_id", { mode: "number" }).notNull(),
      tag: text("tag").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull(),
      emblem: text("emblem"),
      membersCount: integer("members_count").notNull(),
      ratedMembersCount: integer("rated_members_count").notNull(),
      // Battle-weighted average of the ranking metric. DB column name
      // stays `avg_wnx` from before the multi-metric refactor.
      avgValue: numeric("avg_wnx").notNull(),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.metric, t.rank] })],
  );
}

export type TopClansTable = ReturnType<typeof makeTopClansTable>;

export const topClansByRegion: Record<Region, TopClansTable> = {
  [Region.EU]: makeTopClansTable(Region.EU),
  [Region.NA]: makeTopClansTable(Region.NA),
  [Region.ASIA]: makeTopClansTable(Region.ASIA),
};
