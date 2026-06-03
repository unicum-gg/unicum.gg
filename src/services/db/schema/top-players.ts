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

export function makeTopPlayersTable(region: string) {
  return pgTable(
    `${region}_top_players`,
    {
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
    (t) => [primaryKey({ columns: [t.period, t.rank] })],
  );
}

export type TopPlayersTable = ReturnType<typeof makeTopPlayersTable>;

export const topPlayersByRegion: Record<Region, TopPlayersTable> = {
  [Region.EU]: makeTopPlayersTable(Region.EU),
  [Region.NA]: makeTopPlayersTable(Region.NA),
  [Region.ASIA]: makeTopPlayersTable(Region.ASIA),
};
