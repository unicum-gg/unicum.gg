/** Where a team stands in the registration flow. */
export enum TournamentTeamStatus {
  /** Registered but still short of the minimum roster. */
  Forming = "forming",
  /** Roster complete, entered in the bracket. */
  Confirmed = "confirmed",
  Disqualified = "disqualified",
}

/** A team member's part in the roster. */
export enum TournamentTeamRole {
  /** The captain, who registered the team. */
  Owner = "owner",
  Player = "",
}

export type RawTeamPlayer = {
  /** The WG account id, as a string. */
  uuid: string;
  nickname: string;
  role: string;
  status: string;
  team_id: number;
  tournament_id: number;
};

export type RawTeam = {
  id: number;
  tournament_id: number;
  title: string;
  /** The captain's account id, as a string. */
  owner: string;
  status: { code: string; title: string };
  players_number: { players_count: number; max_players_in_team: number };
  players?: RawTeamPlayer[];
  registration_options?: number[] | number;
  extra_data: {
    description: string | null;
    contacts: string | null;
    password: boolean;
    disqualify_reason: string | null;
  };
};

export type TournamentTeamPlayer = {
  accountId: number;
  nickname: string;
  role: TournamentTeamRole;
};

export type TournamentTeam = {
  id: number;
  tournamentId: number;
  /** The team name, entered by the captain. */
  title: string;
  status: TournamentTeamStatus;
  /** The captain's account id. */
  ownerAccountId: number;
  playersCount: number;
  maxPlayers: number;
  /** Empty on the endpoints that return a team as a reference (matches,
   * standings) rather than as a roster. */
  players: TournamentTeamPlayer[];
  /** The captain's team blurb, free text, often empty. */
  description: string | null;
  /**
   * How the captain asks to be reached, free text: a Discord handle, an in-game
   * nickname, a phone number. Kept because the endpoint returns it, but this is
   * personal contact data a player entered to be reached DURING a tournament,
   * not something they published. Do not store it and do not render it.
   */
  contacts: string | null;
  /** Whether joining the team needs the captain's password. */
  isPasswordProtected: boolean;
  disqualifyReason: string | null;
};

/** The endpoint types every id as a string here and as a number elsewhere (the
 * same account is `"595452554"` on a roster and `595452554` in standings), so
 * both are accepted and anything unparseable reads as absent. */
export function accountId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

export function parseTeamPlayer(raw: RawTeamPlayer): TournamentTeamPlayer | null {
  const id = accountId(raw.uuid);
  if (id === null) return null;
  return {
    accountId: id,
    nickname: raw.nickname,
    role: raw.role === TournamentTeamRole.Owner
      ? TournamentTeamRole.Owner
      : TournamentTeamRole.Player,
  };
}

export function parseTeam(raw: RawTeam): TournamentTeam {
  return {
    id: raw.id,
    tournamentId: raw.tournament_id,
    title: raw.title,
    status: raw.status.code as TournamentTeamStatus,
    ownerAccountId: accountId(raw.owner) ?? 0,
    playersCount: raw.players_number.players_count,
    maxPlayers: raw.players_number.max_players_in_team,
    players: (raw.players ?? [])
      .map(parseTeamPlayer)
      .filter((p): p is TournamentTeamPlayer => p !== null),
    description: raw.extra_data.description,
    contacts: raw.extra_data.contacts,
    isPasswordProtected: raw.extra_data.password,
    disqualifyReason: raw.extra_data.disqualify_reason,
  };
}
