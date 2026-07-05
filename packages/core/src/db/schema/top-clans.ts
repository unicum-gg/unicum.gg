import {
  bigint,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming/region";

export function makeTopClansTable(region: string) {
  return pgTable(
    `${region}_top_clans`,
    {
      // 'wn7' | 'wn8' | 'wnx' — the rating used to rank this row. Each
      // period has its own ranking per metric, so (metric, period, rank)
      // is the natural primary key.
      metric: text("metric").notNull(),
      // 'overall' | '30d' — 'overall' ranks by members' lifetime rating,
      // '30d' by their last-30-days form (snapshot-diffed).
      period: text("period").notNull(),
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
    (t) => [primaryKey({ columns: [t.metric, t.period, t.rank] })],
  );
}

export type TopClansTable = ReturnType<typeof makeTopClansTable>;

export const topClansByRegion: Record<Region, TopClansTable> = {
  [Region.EU]: makeTopClansTable(Region.EU),
  [Region.NA]: makeTopClansTable(Region.NA),
  [Region.ASIA]: makeTopClansTable(Region.ASIA),
};
