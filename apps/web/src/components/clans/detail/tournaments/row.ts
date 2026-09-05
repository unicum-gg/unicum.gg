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
  bestPosition: number | null;
};

/** A member of the clan and their tournament record. */
export type ClanTournamentPlayer = {
  accountId: number;
  nickname: string;
  entered: number;
  wins: number;
  featuredWins: number;
  lastAt: Date;
  isVerified?: boolean;
  isSupporter?: boolean;
  twitchLogin?: string | null;
  tournamentBestTitle?: string | null;
};

export type ClanTournamentRecord = {
  clanId: number;
  tag: string;
  entries: ClanTournamentEntry[];
  wins: number;
  players: ClanTournamentPlayer[];
};
