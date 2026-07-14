import {
  bigint,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

export function makeTopPlayersTable(region: string) {
  return pgTable(
    `${region}_top_players`,
    {
      // 'wn7' | 'wn8' | 'wnx' — the rating used to rank this row. Each
      // period has its own ranking per metric, so (metric, period, rank)
      // is the natural primary key.
      metric: text("metric").notNull(),
      period: text("period").notNull(),
      rank: integer("rank").notNull(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      nickname: text("nickname").notNull(),
      clanTag: text("clan_tag"),
      clanColor: text("clan_color"),
      battles: integer("battles").notNull(),
      // Value of the ranking metric for this row (wn7 score for a
      // metric='wn7' row, etc). DB column name stays `wnx` from before
      // the multi-metric refactor.
      value: numeric("wnx").notNull(),
      computedAt: timestamp("computed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.metric, t.period, t.rank] })],
  );
}

export type TopPlayersTable = ReturnType<typeof makeTopPlayersTable>;

export const topPlayersByRegion: Record<Region, TopPlayersTable> = {
  [Region.EU]: makeTopPlayersTable(Region.EU),
  [Region.NA]: makeTopPlayersTable(Region.NA),
  [Region.ASIA]: makeTopPlayersTable(Region.ASIA),
};
