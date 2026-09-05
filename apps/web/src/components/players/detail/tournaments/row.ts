import type {
  TournamentGameMode,
  TournamentStatus,
  TournamentTeamStatus,
} from "@unicum.gg/wargaming";

// The tab's own view of the endpoint's payload. A neutral (non-"use client")
// module, like the tank list's row type: a type crosses the client boundary but
// its declaring module still has to be importable from the server page that
// seeds the tab.

/** One tournament a player entered, and how their team finished. */
export type PlayerTournamentEntry = {
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
  teamId: number;
  teamTitle: string;
  teamStatus: TournamentTeamStatus;
  isCaptain: boolean;
  bestPosition: number | null;
};

/** Someone this player has shared a tournament roster with. */
export type PlayerTournamentTeammate = {
  accountId: number;
  nickname: string;
  clanTag: string | null;
  clanColor: string | null;
  tournamentWins: number;
  tournamentFeaturedWins: number;
  tournamentBestTitle: string | null;
  isVerified?: boolean;
  isSupporter?: boolean;
  twitchLogin?: string | null;
  together: number;
  lastAt: Date;
};

export type PlayerTournamentRecord = {
  accountId: number;
  nickname: string;
  entries: PlayerTournamentEntry[];
  wins: number;
  teammates: PlayerTournamentTeammate[];
};
