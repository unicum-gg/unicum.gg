import type { MapMarker, MapPoi } from "@unicum.gg/shared";
import type {
  BracketType,
  TournamentGameMode,
  TournamentStatus,
  TournamentTeamStatus,
} from "@unicum.gg/wargaming";

// The page's view of `GET /{region}/tournaments/{id}`. A neutral
// (non-"use client") module so the server page that fetches it and the client
// view that renders it can both import the shape.

export type TournamentRosterPlayer = {
  accountId: number;
  nickname: string;
  role: string;
};

export type TournamentTeam = {
  id: number;
  title: string;
  status: TournamentTeamStatus;
  ownerAccountId: number | null;
  playersCount: number;
  players: TournamentRosterPlayer[];
  /** The roster's mean rating over the members we hold stats for, with that
   * count as its denominator. */
  ratedPlayers: number;
  avgWn8: number | null;
  avgWnx: number | null;
  /** The same over the trailing 30 days, counting only the members who played
   * in it, which is the form a team is picked and scouted on. */
  rated30dPlayers: number;
  avgWn830d: number | null;
  avgWnx30d: number | null;
  /** A fraction (0.54), not a percentage. */
  avgWinrate: number | null;
  /** The clan this team fielded on the day, when enough of the roster shared
   * one. */
  clan: {
    clanId: number;
    clanTag: string;
    clanName: string | null;
    clanColor: string | null;
    clanEmblem: string | null;
    members: number;
  } | null;
};

export type TournamentMatch = {
  uuid: string;
  stageId: number;
  groupId: number;
  state: string;
  round: number;
  position: number;
  team1Id: number | null;
  team2Id: number | null;
  winnerTeamId: number | null;
  winsTeam1: number | null;
  winsTeam2: number | null;
  maps: string | null;
  startAt: Date | null;
  nextMatchForWinner: string | null;
};

export type TournamentStanding = {
  teamId: number;
  position: number | null;
  seed: number | null;
  wins: number;
  losses: number;
  draws: number;
  points: number | null;
};

export type TournamentGroup = {
  id: number;
  order: number;
  state: string;
  teamsCount: number;
  matches: TournamentMatch[];
  standings: TournamentStanding[];
};

export type TournamentStage = {
  id: number;
  title: string;
  bracketType: BracketType;
  winnersPerGroup: number;
  startAt: Date | null;
  groups: TournamentGroup[];
};

export type TournamentPrizeTier = {
  title: string;
  order: number;
  prizes: string[];
};

export type TournamentRulesSection = {
  title: string;
  description: string;
  order: number;
};

export type TournamentRecord = {
  id: number;
  title: string;
  description: string;
  status: TournamentStatus;
  gameModes: TournamentGameMode[];
  tierFrom: number | null;
  tierTo: number | null;
  minPlayersInTeam: number;
  maxPlayersInTeam: number;
  confirmedTeams: number;
  /** The field's cap, when the format sets one. */
  teamsLimit: number | null;
  /** Sessions the tournament is played in; the title is the game server. */
  schedule: { title: string; startAt: string }[];
  startAt: Date;
  endAt: Date;
  registrationFrom: Date | null;
  registrationTill: Date | null;
  prize: string | null;
  prizeTiers: TournamentPrizeTier[];
  rules: TournamentRulesSection[];
  mapPool: {
    arenaId: string;
    slug: string | null;
    name: string | null;
    minimapUrl: string | null;
    spawns: { team1: MapMarker[]; team2: MapMarker[] };
    bases: { team1: MapMarker[]; team2: MapMarker[] };
    controlPoint: MapMarker | null;
    pointsOfInterest: MapPoi[];
    widthMeters: number;
    heightMeters: number;
  }[];
  totalLevelFrom: number | null;
  totalLevelTo: number | null;
  logoUrl: string | null;
  teams: TournamentTeam[];
  stages: TournamentStage[];
};
