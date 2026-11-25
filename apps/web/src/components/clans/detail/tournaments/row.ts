import type { PlayerCrestFields } from "@unicum.gg/shared";
import type {
  TournamentGameMode,
  TournamentStatus,
  TournamentTeamStatus,
} from "@unicum.gg/wargaming";

// The tab's view of `GET /{region}/clans/{tag}/tournaments`. A neutral module so
// the server page that fetches it and the client table that renders it share one
// shape.

export type ClanTournamentEntry = {
  tournamentId: number;
  title: string;
  status: TournamentStatus;
  gameModes: TournamentGameMode[];
  tierFrom: number | null;
  tierTo: number | null;
  minPlayersInTeam: number;
  maxPlayersInTeam: number;
  startAt: Date;
  prize: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  teamId: number;
  teamTitle: string;
  teamStatus: TournamentTeamStatus;
  /** How many of the roster were in the clan on the day. */
  clanMembers: number | null;
  /** Where the team finished in the tournament, by the rule its bracket page
   * draws. Null when the tournament placed nothing on it. */
  finalPlace: number | null;
  /** The best place reached in any ONE group, for a team the tournament placed
   * nowhere. Not a tournament result: it is a pool won, or a qualifier topped.
   * Null whenever `finalPlace` is set. */
  groupPlace: number | null;
};

/** A member of the clan and their tournament record. */
export type ClanTournamentPlayer = {
  accountId: number;
  nickname: string;
  entered: number;
  wins: number;
  featuredWins: number;
  lastAt: Date;
} & PlayerCrestFields;

export type ClanTournamentRecord = {
  clanId: number;
  tag: string;
  entries: ClanTournamentEntry[];
  wins: number;
  players: ClanTournamentPlayer[];
};
