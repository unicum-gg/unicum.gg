import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming/region";

export function makeClansTable(region: string) {
  return pgTable(
    `${region}_clans`,
    {
      id: bigint("id", { mode: "number" }).primaryKey(),
      tag: text("tag").notNull(),
      tagLower: text("tag_lower").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull(),
      emblem: text("emblem").notNull(),
      motto: text("motto").notNull(),
      descriptionHtml: text("description_html").notNull(),
      membersCount: integer("members_count").notNull(),
      leaderId: bigint("leader_id", { mode: "number" }).notNull(),
      leaderName: text("leader_name").notNull(),
      creatorId: bigint("creator_id", { mode: "number" }).notNull(),
      creatorName: text("creator_name").notNull(),
      createdAtWg: timestamp("created_at_wg", { withTimezone: true }).notNull(),
      isDisbanded: boolean("is_disbanded").notNull().default(false),
      languages: text("languages").array().notNull().default([]),
      firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    },
    (t) => [
      uniqueIndex(`${region}_clans_tag_lower_idx`).on(t.tagLower),
      index(`${region}_clans_last_refreshed_at_idx`).on(t.lastRefreshedAt),
      // Tag prefix search (search dialog). `text_pattern_ops` makes
      // `tag_lower LIKE 'x%'` a range scan regardless of DB collation.
      index(`${region}_clans_tag_prefix_idx`).on(
        sql`${t.tagLower} text_pattern_ops`,
      ),
    ],
  );
}

export type ClansTable = ReturnType<typeof makeClansTable>;
export type Clan = ClansTable["$inferSelect"];
export type NewClan = ClansTable["$inferInsert"];

export const clansByRegion: Record<Region, ClansTable> = {
  [Region.EU]: makeClansTable(Region.EU),
  [Region.NA]: makeClansTable(Region.NA),
  [Region.ASIA]: makeClansTable(Region.ASIA),
};
