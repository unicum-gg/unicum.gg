import {
  bigint,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const topPlayers = pgTable(
  "top_players",
  {
    region: text("region").notNull(),
    period: text("period").notNull(),
    rank: integer("rank").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    nickname: text("nickname").notNull(),
    clanTag: text("clan_tag"),
    clanColor: text("clan_color"),
    battles: integer("battles").notNull(),
    wnx: numeric("wnx").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.region, t.period, t.rank] })],
);
