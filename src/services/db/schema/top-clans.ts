import {
  bigint,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@/services/wargaming/wot";

export function makeTopClansTable(region: string) {
  return pgTable(`${region}_top_clans`, {
    rank: integer("rank").primaryKey(),
    clanId: bigint("clan_id", { mode: "number" }).notNull(),
    tag: text("tag").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    emblem: text("emblem"),
    membersCount: integer("members_count").notNull(),
    ratedMembersCount: integer("rated_members_count").notNull(),
    avgWnx: numeric("avg_wnx").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type TopClansTable = ReturnType<typeof makeTopClansTable>;

export const topClansByRegion: Record<Region, TopClansTable> = {
  [Region.EU]: makeTopClansTable(Region.EU),
  [Region.NA]: makeTopClansTable(Region.NA),
  [Region.ASIA]: makeTopClansTable(Region.ASIA),
};
