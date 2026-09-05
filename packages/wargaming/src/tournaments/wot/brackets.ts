import { BracketType, DrawManagement } from "./catalog";
import { accountId } from "./teams";

/** How far along a group's play is. */
export enum TournamentGroupState {
  /** Drawn and waiting to start. */
  GroupReady = "group_ready",
  Running = "running",
  Complete = "complete",
}

/** Whether a match has been settled. */
export enum TournamentMatchState {
  /** Scheduled, played or not, but with no score recorded yet. */
  WaitingResults = "waiting_results",
  GotResults = "got_results",
}

export type RawStage = {
  id: number;
  bracket_type: string;
  start_at: number;
  end_at: number;
  visibility: boolean;
  settings: { number_of_winners: number; draw_management: string };
  summary: { groups_count: number };
  translations: { lang: string; title: string; description: string };
};

export type RawGroup = {
  id: number;
  order: number;
  state: string;
  teams_count: number;
  summary: { winner_rounds_count: number; looser_rounds_count: number };
};

export type RawMatchTeam = {
  id: number | null;
  title: string | null;
  owner: string | null;
  status: { code: string; title: string } | null;
};

export type RawMatch = {
  uuid: string;
  tournament_id: number;
  stage_id: number;
  group_id: number;
  team_1_id: number | null;
  team_2_id: number | null;
  team_1: RawMatchTeam | null;
  team_2: RawMatchTeam | null;
  state: string;
  winner_team_id: number | null;
  start_at: number;
  settings?: { map?: string };
  extra_data: {
    wins_team_1: number | null;
    wins_team_2: number | null;
    draws: number | null;
  };
  tournament_system_specific_data: {
    round: number;
    position: number;
    next_match_for_winner_uuid: string | null;
    next_match_for_looser_uuid: string | null;
  };
};

export type RawStanding = {
  id: number;
  group_id: number;
  team_id: number;
  position: number | null;
  team_title?: string;
  team_data?: {
    id: number;
    title: string;
    status: string;
    owner: { uuid: number | string; nickname: string } | null;
  };
  seed_number: number;
  wins: number;
  losses: number;
  draws: number;
  battle_played: number;
  tie_break_wins: number;
  tie_break_losses: number;
  extra_statistics?: { points?: number };
};

/** One phase of a tournament (a qualifier, a group stage, the playoffs). */
export type TournamentStage = {
  id: number;
  title: string;
  description: string;
  bracketType: BracketType;
  drawManagement: DrawManagement;
  /** How many teams advance out of each group. */
  winnersPerGroup: number;
  groupsCount: number;
  startAt: Date;
  endAt: Date;
  isVisible: boolean;
};

/** One bracket inside a stage. A knockout stage has a single group holding the
 * whole tree; a group stage has one per pool. */
export type TournamentGroup = {
  id: number;
  stageId: number;
  /** 1-based, the order the groups are presented in. */
  order: number;
  state: TournamentGroupState;
  teamsCount: number;
  /** Rounds in the winners bracket, and in the losers bracket (0 unless the
   * stage is double elimination). */
  winnerRounds: number;
  looserRounds: number;
};

/** A team as a match references it. Null ids are a slot the bracket has drawn
 * but not filled yet (an unplayed feeder match, or a bye). */
export type TournamentMatchTeam = {
  id: number;
  title: string;
  ownerAccountId: number | null;
};

/** One tie in a bracket: two teams, a best-of series, a winner. */
export type TournamentMatch = {
  /** Stable within a tournament, formatted `<groupId>@<n>`, and the key the
   * bracket tree is threaded on. */
  uuid: string;
  tournamentId: number;
  stageId: number;
  groupId: number;
  state: TournamentMatchState;
  /**
   * In a knockout bracket, the distance from the end rather than the start:
   * round 1 IS the final, 2 the semi-finals, 3 the quarter-finals, counting
   * outwards, and -1 is the third-place match. In a round robin it is the plain
   * 1-based matchday. So the bracket type is what says which way it reads.
   */
  round: number;
  /** The match's slot within its round, top to bottom. */
  position: number;
  team1: TournamentMatchTeam | null;
  team2: TournamentMatchTeam | null;
  winnerTeamId: number | null;
  /** Battles won either side, null until the match is settled. */
  score: { team1: number; team2: number; draws: number } | null;
  /** The maps played, as the organiser wrote them ("Cliff, Sand River"). Free
   * text, not arena ids. */
  maps: string | null;
  startAt: Date;
  /** Where the winner (and, in double elimination, the loser) plays next. */
  nextMatchForWinner: string | null;
  nextMatchForLooser: string | null;
};

/** A team's line in a group table. */
export type TournamentStanding = {
  groupId: number;
  teamId: number;
  teamTitle: string | null;
  /** The captain, when the endpoint carries the team's full record. */
  ownerAccountId: number | null;
  ownerNickname: string | null;
  /**
   * Placement within the group, not within the tournament, and not dense: in a
   * single-elimination bracket every team out in the same round shares a rank,
   * so it runs 1, 2, 4, 4, 8, 8, 8, 8.
   *
   * Null across a whole DOUBLE-elimination bracket, which fills in only the
   * seeding and leaves the placement unset. There, finishing order has to be
   * read off the match tree.
   */
  position: number | null;
  seed: number;
  /** Only a round robin counts these. A knockout table carries the placement
   * and leaves every counter at zero, which is absence, not a 0-0 record. */
  wins: number;
  losses: number;
  draws: number;
  battlesPlayed: number;
  tieBreakWins: number;
  tieBreakLosses: number;
  points: number | null;
};

export function parseStage(raw: RawStage): TournamentStage {
  return {
    id: raw.id,
    title: raw.translations.title,
    description: raw.translations.description,
    bracketType: raw.bracket_type as BracketType,
    drawManagement: raw.settings.draw_management as DrawManagement,
    winnersPerGroup: raw.settings.number_of_winners,
    groupsCount: raw.summary.groups_count,
    startAt: new Date(raw.start_at * 1000),
    endAt: new Date(raw.end_at * 1000),
    isVisible: raw.visibility,
  };
}

export function parseGroup(raw: RawGroup, stageId: number): TournamentGroup {
  return {
    id: raw.id,
    stageId,
    order: raw.order,
    state: raw.state as TournamentGroupState,
    teamsCount: raw.teams_count,
    winnerRounds: raw.summary.winner_rounds_count,
    looserRounds: raw.summary.looser_rounds_count,
  };
}

/** An undecided slot comes back as a fully-null team object rather than as a
 * null, so presence of the wrapper says nothing and the id is what decides. */
function parseMatchTeam(raw: RawMatchTeam | null): TournamentMatchTeam | null {
  if (!raw?.id) return null;
  return {
    id: raw.id,
    title: raw.title ?? "",
    ownerAccountId: accountId(raw.owner),
  };
}

export function parseMatch(raw: RawMatch): TournamentMatch {
  const { wins_team_1: w1, wins_team_2: w2, draws } = raw.extra_data;
  const specific = raw.tournament_system_specific_data;
  return {
    uuid: raw.uuid,
    tournamentId: raw.tournament_id,
    stageId: raw.stage_id,
    groupId: raw.group_id,
    state: raw.state as TournamentMatchState,
    round: specific.round,
    position: specific.position,
    team1: parseMatchTeam(raw.team_1),
    team2: parseMatchTeam(raw.team_2),
    winnerTeamId: raw.winner_team_id,
    score:
      w1 === null || w2 === null
        ? null
        : { team1: w1, team2: w2, draws: draws ?? 0 },
    maps: raw.settings?.map || null,
    startAt: new Date(raw.start_at * 1000),
    nextMatchForWinner: specific.next_match_for_winner_uuid,
    nextMatchForLooser: specific.next_match_for_looser_uuid,
  };
}

export function parseStanding(raw: RawStanding): TournamentStanding {
  return {
    groupId: raw.group_id,
    teamId: raw.team_id,
    teamTitle: raw.team_title ?? raw.team_data?.title ?? null,
    ownerAccountId: accountId(raw.team_data?.owner?.uuid),
    ownerNickname: raw.team_data?.owner?.nickname ?? null,
    position: raw.position,
    seed: raw.seed_number,
    wins: raw.wins,
    losses: raw.losses,
    draws: raw.draws,
    battlesPlayed: raw.battle_played,
    tieBreakWins: raw.tie_break_wins,
    tieBreakLosses: raw.tie_break_losses,
    points: raw.extra_statistics?.points ?? null,
  };
}
