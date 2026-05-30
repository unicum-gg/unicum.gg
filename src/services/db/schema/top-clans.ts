import {
  bigint,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const topClans = pgTable(
  "top_clans",
  {
    region: text("region").notNull(),
    rank: integer("rank").notNull(),
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
  },
  (t) => [primaryKey({ columns: [t.region, t.rank] })],
);
