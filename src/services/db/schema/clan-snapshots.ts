import {
  bigint,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@/services/wargaming/wot";
import { type ClansTable, clansByRegion } from "./clans";

export function makeClanSnapshotsTable(region: string, clans: ClansTable) {
  return pgTable(
    `${region}_clan_snapshots`,
    {
      id: serial("id").primaryKey(),
      clanId: bigint("clan_id", { mode: "number" })
        .notNull()
        .references(() => clans.id, { onDelete: "cascade" }),
      takenAt: timestamp("taken_at", { withTimezone: true })
        .notNull()
        .defaultNow(),

      eloT6: integer("elo_t6"),
      skirmishBattlesT6: integer("skirmish_battles_t6"),
      skirmishWinsT6: integer("skirmish_wins_t6"),

      eloT8: integer("elo_t8"),
      skirmishBattlesT8: integer("skirmish_battles_t8"),
      skirmishWinsT8: integer("skirmish_wins_t8"),

      eloT10: integer("elo_t10"),
      skirmishBattlesT10: integer("skirmish_battles_t10"),
      skirmishWinsT10: integer("skirmish_wins_t10"),

      advancesBattlesT10: integer("advances_battles_t10"),
      advancesWinsT10: integer("advances_wins_t10"),
    },
    (t) => [
      index(`${region}_clan_snapshots_clan_id_taken_at_idx`).on(
        t.clanId,
        t.takenAt,
      ),
    ],
  );
}

export type ClanSnapshotsTable = ReturnType<typeof makeClanSnapshotsTable>;
export type ClanSnapshot = ClanSnapshotsTable["$inferSelect"];
export type NewClanSnapshot = ClanSnapshotsTable["$inferInsert"];

export const clanSnapshotsByRegion: Record<Region, ClanSnapshotsTable> = {
  [Region.EU]: makeClanSnapshotsTable(Region.EU, clansByRegion[Region.EU]),
  [Region.NA]: makeClanSnapshotsTable(Region.NA, clansByRegion[Region.NA]),
  [Region.ASIA]: makeClanSnapshotsTable(Region.ASIA, clansByRegion[Region.ASIA]),
};
