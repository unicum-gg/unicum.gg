import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const clans = pgTable(
  "clans",
  {
    region: text("region").notNull(),
    id: bigint("id", { mode: "number" }).notNull(),
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
    primaryKey({ columns: [t.region, t.id] }),
    uniqueIndex("clans_region_tag_lower_idx").on(t.region, t.tagLower),
    index("clans_last_refreshed_at_idx").on(t.lastRefreshedAt),
  ],
);

export type Clan = typeof clans.$inferSelect;
export type NewClan = typeof clans.$inferInsert;
