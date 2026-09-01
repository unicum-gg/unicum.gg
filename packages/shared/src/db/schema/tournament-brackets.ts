import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * How a tournament was actually played: its phases, its brackets, every tie and
 * every score. Mirrored alongside `<region>_tournaments`, whose id these all
 * hang off.
 *
 * Wargaming publishes this only through a client-rendered bracket widget, so it
 * is invisible to anything that does not run their JavaScript, and it is dropped
 * from nowhere else: the public API knows nothing about tournaments.
 */
export function makeTournamentStagesTable(region: string) {
  return pgTable(
    `${region}_tournament_stages`,
    {
      id: bigint("id", { mode: "number" }).primaryKey(),
      tournamentId: bigint("tournament_id", { mode: "number" }).notNull(),
      title: text("title").notNull(),
      description: text("description").notNull().default(""),
      // SE (single elimination) / DE (double) / RR (round robin).
      bracketType: text("bracket_type").notNull(),
      // What a drawn match does here: auto_loss / keep_draw / tie_break /
      // give_win_tie_break_owner.
      drawManagement: text("draw_management").notNull(),
      // How many teams advance out of each group.
      winnersPerGroup: integer("winners_per_group").notNull().default(1),
      groupsCount: integer("groups_count").notNull().default(0),
      startAt: timestamp("start_at", { withTimezone: true }),
      endAt: timestamp("end_at", { withTimezone: true }),
    },
    (t) => [
      index(`${region}_tournament_stages_tournament_idx`).on(t.tournamentId, t.startAt),
    ],
  );
}

export type TournamentStagesTable = ReturnType<typeof makeTournamentStagesTable>;

export const tournamentStagesByRegion: Record<Region, TournamentStagesTable> = {
  [Region.EU]: makeTournamentStagesTable(Region.EU),
  [Region.NA]: makeTournamentStagesTable(Region.NA),
  [Region.ASIA]: makeTournamentStagesTable(Region.ASIA),
};

/**
 * One bracket inside a stage. A knockout stage holds its whole tree in a single
 * group; a group stage has one per pool.
 */
export function makeTournamentGroupsTable(region: string) {
  return pgTable(
    `${region}_tournament_groups`,
    {
      id: bigint("id", { mode: "number" }).primaryKey(),
      tournamentId: bigint("tournament_id", { mode: "number" }).notNull(),
      stageId: bigint("stage_id", { mode: "number" }).notNull(),
      // 1-based, the order the groups are presented in.
      order: integer("order").notNull().default(1),
      // group_ready / running / complete.
      state: text("state").notNull(),
      teamsCount: integer("teams_count").notNull().default(0),
      winnerRounds: integer("winner_rounds").notNull().default(0),
      // Non-zero only in a double-elimination stage.
      looserRounds: integer("looser_rounds").notNull().default(0),
    },
    (t) => [
      index(`${region}_tournament_groups_stage_idx`).on(t.stageId, t.order),
      index(`${region}_tournament_groups_tournament_idx`).on(t.tournamentId),
    ],
  );
}

export type TournamentGroupsTable = ReturnType<typeof makeTournamentGroupsTable>;

export const tournamentGroupsByRegion: Record<Region, TournamentGroupsTable> = {
  [Region.EU]: makeTournamentGroupsTable(Region.EU),
  [Region.NA]: makeTournamentGroupsTable(Region.NA),
  [Region.ASIA]: makeTournamentGroupsTable(Region.ASIA),
};

/**
 * One tie: two teams, a best-of series, a winner. The bracket tree is threaded
 * on `uuid` through `next_match_for_winner`, so a match knows where its winner
 * plays next rather than the tree being rebuilt from rounds and positions.
 */
export function makeTournamentMatchesTable(region: string) {
  return pgTable(
    `${region}_tournament_matches`,
    {
      // Formatted `<groupId>@<n>`, unique within a tournament but not across
      // them, so the key is the pair.
      uuid: text("uuid").notNull(),
      tournamentId: bigint("tournament_id", { mode: "number" }).notNull(),
      stageId: bigint("stage_id", { mode: "number" }).notNull(),
      groupId: bigint("group_id", { mode: "number" }).notNull(),
      // waiting_results / got_results.
      state: text("state").notNull(),
      /**
       * In a knockout, the distance from the end rather than the start: round 1
       * IS the final, 2 the semi-finals, counting outwards, and -1 the
       * third-place match. In a round robin it is the plain matchday. The
       * stage's bracket type is what says which way to read it.
       */
      round: integer("round").notNull(),
      position: integer("position").notNull(),
      // Null while the bracket has drawn the slot but not filled it (an
      // unplayed feeder match, or a bye).
      team1Id: bigint("team_1_id", { mode: "number" }),
      team2Id: bigint("team_2_id", { mode: "number" }),
      winnerTeamId: bigint("winner_team_id", { mode: "number" }),
      // Battles won either side. Null until the match is settled, which is not
      // the same as 0-0.
      winsTeam1: integer("wins_team_1"),
      winsTeam2: integer("wins_team_2"),
      draws: integer("draws"),
      // The maps played, as the organiser wrote them ("Cliff, Sand River").
      // Free text, not arena ids: matching it to the map catalogue is a
      // name lookup, and an organiser's typo simply does not match.
      maps: text("maps"),
      startAt: timestamp("start_at", { withTimezone: true }),
      nextMatchForWinner: text("next_match_for_winner"),
      nextMatchForLooser: text("next_match_for_looser"),
    },
    (t) => [
      primaryKey({ columns: [t.tournamentId, t.uuid] }),
      // Drawing one bracket, in tree order.
      index(`${region}_tournament_matches_group_idx`).on(t.groupId, t.round, t.position),
      // A team's run through its tournament, from either side of the tie.
      index(`${region}_tournament_matches_team1_idx`).on(t.team1Id),
      index(`${region}_tournament_matches_team2_idx`).on(t.team2Id),
    ],
  );
}

export type TournamentMatchesTable = ReturnType<typeof makeTournamentMatchesTable>;

export const tournamentMatchesByRegion: Record<Region, TournamentMatchesTable> = {
  [Region.EU]: makeTournamentMatchesTable(Region.EU),
  [Region.NA]: makeTournamentMatchesTable(Region.NA),
  [Region.ASIA]: makeTournamentMatchesTable(Region.ASIA),
};

/**
 * A team's line in one bracket's table, which is where a placement comes from:
 * the match tree says who beat whom but never who finished third.
 *
 * What the row carries depends on the bracket. A round robin fills the counters
 * in. A single elimination records the placement and leaves them at zero, so a
 * 0-0 row there is absence, not a team that played nothing, and `position` is
 * the only field to read; its positions are not dense either, since teams out in
 * the same round share a rank (1, 2, 4, 4, 8, 8, 8, 8). A double elimination
 * fills in neither, only the seeding, so its finishing order has to be read off
 * the match tree.
 */
export function makeTournamentStandingsTable(region: string) {
  return pgTable(
    `${region}_tournament_standings`,
    {
      tournamentId: bigint("tournament_id", { mode: "number" }).notNull(),
      stageId: bigint("stage_id", { mode: "number" }).notNull(),
      groupId: bigint("group_id", { mode: "number" }).notNull(),
      teamId: bigint("team_id", { mode: "number" }).notNull(),
      // Null across a whole double-elimination bracket, which fills in only the
      // seeding: there, finishing order has to be read off the match tree.
      position: integer("position"),
      seed: integer("seed"),
      wins: integer("wins").notNull().default(0),
      losses: integer("losses").notNull().default(0),
      draws: integer("draws").notNull().default(0),
      battlesPlayed: integer("battles_played").notNull().default(0),
      tieBreakWins: integer("tie_break_wins").notNull().default(0),
      tieBreakLosses: integer("tie_break_losses").notNull().default(0),
      points: integer("points"),
    },
    (t) => [
      // A team can place in several groups of one tournament (a qualifier, then
      // the group stage it earned), so the group is part of the key.
      primaryKey({ columns: [t.groupId, t.teamId] }),
      index(`${region}_tournament_standings_tournament_idx`).on(
        t.tournamentId,
        t.position,
      ),
      index(`${region}_tournament_standings_team_idx`).on(t.teamId),
    ],
  );
}

export type TournamentStandingsTable = ReturnType<typeof makeTournamentStandingsTable>;

export const tournamentStandingsByRegion: Record<Region, TournamentStandingsTable> = {
  [Region.EU]: makeTournamentStandingsTable(Region.EU),
  [Region.NA]: makeTournamentStandingsTable(Region.NA),
  [Region.ASIA]: makeTournamentStandingsTable(Region.ASIA),
};
