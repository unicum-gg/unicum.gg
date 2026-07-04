import {
  bigint,
  index,
  integer,
  pgTable,
  real,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming/region";
import { type PlayersTable, playersByRegion } from "./players";

export function makePlayerSnapshotsTable(
  region: string,
  players: PlayersTable,
) {
  return pgTable(
    `${region}_player_snapshots`,
    {
      id: serial("id").primaryKey(),
      playerId: integer("player_id")
        .notNull()
        .references(() => players.id, { onDelete: "cascade" }),
      takenAt: timestamp("taken_at", { withTimezone: true })
        .notNull()
        .defaultNow(),

      battles: integer("battles").notNull(),
      wins: integer("wins").notNull(),
      losses: integer("losses").notNull(),
      draws: integer("draws").notNull(),
      survivedBattles: integer("survived_battles").notNull(),
      frags: integer("frags").notNull(),
      damageDealt: bigint("damage_dealt", { mode: "number" }).notNull(),
      damageReceived: bigint("damage_received", { mode: "number" }).notNull(),
      xp: bigint("xp", { mode: "number" }).notNull(),
      battleAvgXp: integer("battle_avg_xp").notNull(),
      spotted: integer("spotted").notNull(),
      capturePoints: integer("capture_points").notNull(),
      droppedCapturePoints: integer("dropped_capture_points").notNull(),
      hits: integer("hits").notNull(),
      shots: integer("shots").notNull(),
      hitsPercents: real("hits_percents").notNull(),
      globalRating: integer("global_rating").notNull(),
      wtr: integer("wtr"),
      clanId: bigint("clan_id", { mode: "number" }),

      skirmishBattles: integer("skirmish_battles"),
      skirmishWins: integer("skirmish_wins"),
      skirmishLosses: integer("skirmish_losses"),
      skirmishDraws: integer("skirmish_draws"),
      skirmishSurvivedBattles: integer("skirmish_survived_battles"),
      skirmishFrags: integer("skirmish_frags"),
      skirmishDamageDealt: bigint("skirmish_damage_dealt", { mode: "number" }),
      skirmishSpotted: integer("skirmish_spotted"),
      skirmishCapturePoints: integer("skirmish_capture_points"),
      skirmishDroppedCapturePoints: integer("skirmish_dropped_capture_points"),
      skirmishBattleAvgXp: integer("skirmish_battle_avg_xp"),

      fortifiedBattles: integer("fortified_battles"),
      fortifiedWins: integer("fortified_wins"),
      fortifiedLosses: integer("fortified_losses"),
      fortifiedDraws: integer("fortified_draws"),
      fortifiedSurvivedBattles: integer("fortified_survived_battles"),
      fortifiedFrags: integer("fortified_frags"),
      fortifiedDamageDealt: bigint("fortified_damage_dealt", { mode: "number" }),
      fortifiedSpotted: integer("fortified_spotted"),
      fortifiedCapturePoints: integer("fortified_capture_points"),
      fortifiedDroppedCapturePoints: integer("fortified_dropped_capture_points"),
      fortifiedBattleAvgXp: integer("fortified_battle_avg_xp"),

      epicBattles: integer("epic_battles"),
      epicWins: integer("epic_wins"),
      epicLosses: integer("epic_losses"),
      epicDraws: integer("epic_draws"),
      epicSurvivedBattles: integer("epic_survived_battles"),
      epicFrags: integer("epic_frags"),
      epicDamageDealt: bigint("epic_damage_dealt", { mode: "number" }),
      epicSpotted: integer("epic_spotted"),
      epicCapturePoints: integer("epic_capture_points"),
      epicDroppedCapturePoints: integer("epic_dropped_capture_points"),
      epicBattleAvgXp: integer("epic_battle_avg_xp"),

      falloutBattles: integer("fallout_battles"),
      falloutWins: integer("fallout_wins"),
      falloutLosses: integer("fallout_losses"),
      falloutDraws: integer("fallout_draws"),
      falloutSurvivedBattles: integer("fallout_survived_battles"),
      falloutFrags: integer("fallout_frags"),
      falloutDamageDealt: bigint("fallout_damage_dealt", { mode: "number" }),
      falloutSpotted: integer("fallout_spotted"),
      falloutCapturePoints: integer("fallout_capture_points"),
      falloutDroppedCapturePoints: integer("fallout_dropped_capture_points"),
      falloutBattleAvgXp: integer("fallout_battle_avg_xp"),

      rankedBattles: integer("ranked_battles"),
      rankedWins: integer("ranked_wins"),
      rankedLosses: integer("ranked_losses"),
      rankedDraws: integer("ranked_draws"),
      rankedSurvivedBattles: integer("ranked_survived_battles"),
      rankedFrags: integer("ranked_frags"),
      rankedDamageDealt: bigint("ranked_damage_dealt", { mode: "number" }),
      rankedSpotted: integer("ranked_spotted"),
      rankedCapturePoints: integer("ranked_capture_points"),
      rankedDroppedCapturePoints: integer("ranked_dropped_capture_points"),
      rankedBattleAvgXp: integer("ranked_battle_avg_xp"),

      cwAbsoluteBattles: integer("cw_absolute_battles"),
      cwAbsoluteWins: integer("cw_absolute_wins"),
      cwAbsoluteLosses: integer("cw_absolute_losses"),
      cwAbsoluteDraws: integer("cw_absolute_draws"),
      cwAbsoluteSurvivedBattles: integer("cw_absolute_survived_battles"),
      cwAbsoluteFrags: integer("cw_absolute_frags"),
      cwAbsoluteDamageDealt: bigint("cw_absolute_damage_dealt", { mode: "number" }),
      cwAbsoluteSpotted: integer("cw_absolute_spotted"),
      cwAbsoluteCapturePoints: integer("cw_absolute_capture_points"),
      cwAbsoluteDroppedCapturePoints: integer("cw_absolute_dropped_capture_points"),
      cwAbsoluteBattleAvgXp: integer("cw_absolute_battle_avg_xp"),

      cwChampionBattles: integer("cw_champion_battles"),
      cwChampionWins: integer("cw_champion_wins"),
      cwChampionLosses: integer("cw_champion_losses"),
      cwChampionDraws: integer("cw_champion_draws"),
      cwChampionSurvivedBattles: integer("cw_champion_survived_battles"),
      cwChampionFrags: integer("cw_champion_frags"),
      cwChampionDamageDealt: bigint("cw_champion_damage_dealt", { mode: "number" }),
      cwChampionSpotted: integer("cw_champion_spotted"),
      cwChampionCapturePoints: integer("cw_champion_capture_points"),
      cwChampionDroppedCapturePoints: integer("cw_champion_dropped_capture_points"),
      cwChampionBattleAvgXp: integer("cw_champion_battle_avg_xp"),

      cwMiddleBattles: integer("cw_middle_battles"),
      cwMiddleWins: integer("cw_middle_wins"),
      cwMiddleLosses: integer("cw_middle_losses"),
      cwMiddleDraws: integer("cw_middle_draws"),
      cwMiddleSurvivedBattles: integer("cw_middle_survived_battles"),
      cwMiddleFrags: integer("cw_middle_frags"),
      cwMiddleDamageDealt: bigint("cw_middle_damage_dealt", { mode: "number" }),
      cwMiddleSpotted: integer("cw_middle_spotted"),
      cwMiddleCapturePoints: integer("cw_middle_capture_points"),
      cwMiddleDroppedCapturePoints: integer("cw_middle_dropped_capture_points"),
      cwMiddleBattleAvgXp: integer("cw_middle_battle_avg_xp"),
    },
    (t) => [
      index(`${region}_snapshots_player_id_taken_at_idx`).on(
        t.playerId,
        t.takenAt,
      ),
      uniqueIndex(`${region}_snapshots_player_id_battles_unique_idx`).on(
        t.playerId,
        t.battles,
      ),
      index(`${region}_snapshots_clan_id_idx`).on(t.clanId),
    ],
  );
}

export type PlayerSnapshotsTable = ReturnType<typeof makePlayerSnapshotsTable>;
export type PlayerSnapshot = PlayerSnapshotsTable["$inferSelect"];
export type NewPlayerSnapshot = PlayerSnapshotsTable["$inferInsert"];

export const playerSnapshotsByRegion: Record<Region, PlayerSnapshotsTable> = {
  [Region.EU]: makePlayerSnapshotsTable(Region.EU, playersByRegion[Region.EU]),
  [Region.NA]: makePlayerSnapshotsTable(Region.NA, playersByRegion[Region.NA]),
  [Region.ASIA]: makePlayerSnapshotsTable(
    Region.ASIA,
    playersByRegion[Region.ASIA],
  ),
};
