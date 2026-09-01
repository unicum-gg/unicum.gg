/** Where a tournament is in its lifecycle. */
export enum TournamentStatus {
  Upcoming = "upcoming",
  RegistrationStarted = "registration_started",
  RegistrationFinished = "registration_finished",
  Running = "running",
  /** Play is over, results are still being settled. */
  Finished = "finished",
  /** Settled: the bracket is final and will not change again. */
  Complete = "complete",
}

/**
 * The battle type a tournament is played in. These are the game's own arena
 * gameplay codes, so `ctf`/`domination` line up with the map catalogue, with
 * two that only tournaments use: `assault2` (the attack/defense setup Global
 * Map landings run on) and `comp7` (Onslaught).
 */
export enum TournamentGameMode {
  Standard = "ctf",
  Encounter = "domination",
  AttackDefense = "assault2",
  Onslaught = "comp7",
}

/** How a stage's teams are paired up. */
export enum BracketType {
  SingleElimination = "SE",
  DoubleElimination = "DE",
  RoundRobin = "RR",
}

/** What a stage does with a drawn match. */
export enum DrawManagement {
  /** Both teams go out (single elimination). */
  AutoLoss = "auto_loss",
  /** The draw stands and both teams take a point (round robin). */
  KeepDraw = "keep_draw",
  /** Replay to settle it. */
  TieBreak = "tie_break",
  /** The team that owns the tiebreak takes the win. */
  GiveWinTieBreakOwner = "give_win_tie_break_owner",
}

/** Who a registration is open to. */
export enum TournamentRegistrationType {
  Event = "registration/event",
  Community = "registration/community",
}

type RawNamed = { code: string; title: string };

type RawTranslations = {
  lang: string;
  title: string;
  description: string;
  extra_data?: {
    prize?: string;
    other_rules?: string;
    prize_parsed?: { title: string; order: number; prizes: string[] | string }[];
    rules_parsed?: { title: string; description: string; order: number }[];
  };
};

type RawExtraData = {
  allowed_vehicles_tier_from: number | null;
  allowed_vehicles_tier_up_to: number | null;
  game_mode: RawNamed[];
  /** Wargaming's INTERNAL realm code, not the public region: `eu` / `us` / `sg`. */
  realm: string;
  team_type: string | null;
  limits_total_level_from?: number;
  limits_total_level_up?: number;
  bracket_types?: { code: string; title: string; description: string }[];
  map_pool?: {
    code: string;
    title: string;
    description: string;
    game_modes?: Record<string, RawNamed>;
  }[];
};

export type RawTournament = {
  id: number;
  start_at: number;
  end_at: number;
  teams_limit: number;
  is_featured: boolean;
  is_closed_registration_tag?: boolean;
  visibility?: boolean;
  extra_data: RawExtraData;
  translations: RawTranslations;
  tags?: { id: number; name: string }[];
  files?: { logo_original?: string };
  schedule?: { title: string; start: number }[];
  registrations?: {
    type: string;
    available_from: number;
    available_till: number;
    registered_entities_limit: number | null;
  }[];
  summary: {
    status: RawNamed;
    confirmed_teams: number;
    min_players_in_team: number;
    max_players_in_team: number;
    registration_available_from: number;
    registration_available_till: number;
    matches_start_at: number;
  };
};

/** One map a tournament may be played on, with the battle types it allows. */
export type TournamentMapPoolEntry = {
  /** The arena id (`04_himmelsdorf`), the same key the map catalogue uses. */
  arenaId: string;
  name: string;
  description: string;
  gameModes: TournamentGameMode[];
};

/** One placement band and what it pays. */
export type TournamentPrizeTier = {
  /** As written by the organiser: "1st place:", "5th-6th place:". */
  title: string;
  /** The organiser's own ordering, which REPEATS: a live tournament ships
   * 1, 2, 3, 4, 4. It sorts the bands, it does not identify them, so a reader
   * keying a list on it collides. */
  order: number;
  /** Free text, one line per reward ("500,000 Gold + 100,000 Bonds"). */
  prizes: string[];
};

/** One block of the organiser's rules. `description` is raw HTML. */
export type TournamentRulesSection = {
  title: string;
  description: string;
  order: number;
};

/** A tournament as the catalogue lists it. */
export type TournamentSummary = {
  id: number;
  title: string;
  /** Raw HTML, as entered by the organiser. */
  description: string;
  language: string;
  status: TournamentStatus;
  /** Wargaming's internal realm code (`eu` / `us` / `sg`). */
  realm: string;
  gameModes: TournamentGameMode[];
  /**
   * The tier band the tournament is played at, null when the organiser left
   * that bound open. Rare (one row in a thousand across the three archives) but
   * real, and a missing floor is not tier 1: it is no floor.
   */
  tierFrom: number | null;
  tierTo: number | null;
  teamSize: { min: number; max: number };
  /** Cap on entrants, or null when the tournament sets none (the usual case,
   * reported as a literal 0). */
  teamsLimit: number | null;
  confirmedTeams: number;
  startAt: Date;
  endAt: Date;
  registrationFrom: Date | null;
  registrationTill: Date | null;
  /** Free text ("Gold", "Gold + Bonds + Cash!"). The structured breakdown is
   * only on the detail. */
  prize: string | null;
  tags: { id: number; name: string }[];
  logoUrl: string | null;
  isFeatured: boolean;
};

/** Everything the catalogue carries, plus what only the detail endpoint returns. */
export type TournamentDetail = TournamentSummary & {
  /** The maps this tournament is played on. Empty when the organiser left it
   * open rather than picking a pool. */
  mapPool: TournamentMapPoolEntry[];
  /** The bracket types this tournament's stages use. */
  bracketTypes: BracketType[];
  /** Total tier points a team may field at once, when the format caps it. */
  totalLevelLimit: { from: number; to: number } | null;
  prizeTiers: TournamentPrizeTier[];
  rules: TournamentRulesSection[];
  /** Free text appended under the rules, or null. */
  otherRules: string | null;
  /** Named session times ("EU 2"), for a tournament run across several. */
  schedule: { title: string; startAt: Date }[];
  registrationType: TournamentRegistrationType | null;
};

/** Unix seconds to `Date`, treating the endpoint's 0 as "unset" rather than 1970. */
function at(seconds: number | null | undefined): Date | null {
  return seconds ? new Date(seconds * 1000) : null;
}

function isGameMode(code: string): code is TournamentGameMode {
  return (Object.values(TournamentGameMode) as string[]).includes(code);
}

function isBracketType(code: string): code is BracketType {
  return (Object.values(BracketType) as string[]).includes(code);
}

/** Modes the endpoint names but the enum does not know are dropped rather than
 * cast: a tournament in an unmodelled battle type is still a real tournament,
 * and reading its mode list as a lie would be worse than reading it as empty. */
function gameModes(raw: RawNamed[] | undefined): TournamentGameMode[] {
  return (raw ?? []).map((m) => m.code).filter(isGameMode);
}

export function parseTournamentSummary(raw: RawTournament): TournamentSummary {
  const reg = raw.registrations?.[0];
  return {
    id: raw.id,
    title: raw.translations.title,
    description: raw.translations.description,
    language: raw.translations.lang,
    status: raw.summary.status.code as TournamentStatus,
    realm: raw.extra_data.realm,
    gameModes: gameModes(raw.extra_data.game_mode),
    tierFrom: raw.extra_data.allowed_vehicles_tier_from ?? null,
    tierTo: raw.extra_data.allowed_vehicles_tier_up_to ?? null,
    teamSize: {
      min: raw.summary.min_players_in_team,
      max: raw.summary.max_players_in_team,
    },
    teamsLimit: raw.teams_limit || null,
    confirmedTeams: raw.summary.confirmed_teams,
    startAt: new Date(raw.start_at * 1000),
    endAt: new Date(raw.end_at * 1000),
    // `||`, not `??`: the summary encodes "unset" as 0 rather than null, so
    // nullish coalescing kept the zero and threw away the real timestamp
    // sitting in the registration entry beside it.
    registrationFrom: at(
      raw.summary.registration_available_from || reg?.available_from,
    ),
    registrationTill: at(
      raw.summary.registration_available_till || reg?.available_till,
    ),
    prize: raw.translations.extra_data?.prize ?? null,
    tags: raw.tags ?? [],
    logoUrl: raw.files?.logo_original ?? null,
    isFeatured: raw.is_featured,
  };
}

export function parseTournamentDetail(raw: RawTournament): TournamentDetail {
  const extra = raw.translations.extra_data;
  const levelFrom = raw.extra_data.limits_total_level_from;
  const levelTo = raw.extra_data.limits_total_level_up;
  return {
    ...parseTournamentSummary(raw),
    mapPool: (raw.extra_data.map_pool ?? []).map((m) => ({
      arenaId: m.code,
      name: m.title,
      description: m.description,
      gameModes: gameModes(Object.values(m.game_modes ?? {})),
    })),
    bracketTypes: (raw.extra_data.bracket_types ?? [])
      .map((b) => b.code)
      .filter(isBracketType),
    totalLevelLimit:
      levelFrom !== undefined && levelTo !== undefined
        ? { from: levelFrom, to: levelTo }
        : null,
    // A tier with a single reward comes back as a bare string rather than a
    // one-element list, so it is normalised here instead of at every reader.
    prizeTiers: (extra?.prize_parsed ?? []).map((p) => ({
      title: p.title,
      order: p.order,
      prizes: Array.isArray(p.prizes) ? p.prizes : [p.prizes],
    })),
    rules: extra?.rules_parsed ?? [],
    otherRules: extra?.other_rules || null,
    schedule: (raw.schedule ?? []).map((s) => ({
      title: s.title,
      startAt: new Date(s.start * 1000),
    })),
    registrationType:
      (raw.registrations?.[0]?.type as TournamentRegistrationType) ?? null,
  };
}
