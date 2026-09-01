import * as z from "zod";
import {
  BattleFormat,
  BattleResult,
  BattleType,
  ClanBoard,
  DEFAULT_RATING_METRIC,
  MapCamouflage,
  MapGameMode,
  RatingBlock,
  RatingConsensus,
  RatingMetric,
  ReviewOutcome,
  ServerStatsRange,
  SessionGranularity,
  SpawnDirection,
  TankClient,
  TankRatingAxis,
  TankReviewStatus,
  VoterBracket,
} from "@unicum.gg/shared";
import {
  BracketType,
  Region,
  TournamentGameMode,
  TournamentStatus,
  TournamentTeamStatus,
} from "@unicum.gg/wargaming";
// Imported from the dependency-free `period` modules (not the DB-heavy index)
// so loading these schemas never pulls in the leaderboard logic.
import { TopPlayersPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period";
import { TopClansPeriod } from "@unicum.gg/core/wargaming/wot/clans/top/period";
import type { EnumSourceKey } from "./enum-sources";

// Single source of truth for the public API surface. These Zod schemas are
// consumed by the route handlers (runtime validation) and by the OpenAPI
// document builder, so the spec can never drift from the code.
//
// Enum fields pass their native source enum straight to `z.enum(...)`, so the
// domain enum is the one source of the allowed values (Zod validates against it
// at runtime). next-openapi-gen can't read a native enum, though, so it emits
// the param with no `enum` in the spec; each enum field therefore carries an
// `x-enum-source` marker (a key of `OPENAPI_ENUM_SOURCES`) that
// `scripts/inject-openapi-enums.ts` fills with the values after generation.
//
// Two hard constraints on the marker, both from next-openapi-gen's static AST
// reader: (1) the `.meta` MUST be an inline object literal — a helper call or a
// spread makes it silently drop the whole `.meta`; (2) the cast is `as EnumMeta`
// (not a checked object type) because Zod's meta type rejects custom `x-*` keys.
// So the marker's key is validated at build time by the injection script (it
// throws on an unknown one), not by tsc. `example` is inlined for the same AST
// reason.
// Exported so a co-located `schema.api.ts` can carry the marker on a field that
// belongs to its own endpoint, instead of hardcoding the values back.
export type EnumMeta = z.core.GlobalMeta & { "x-enum-source": EnumSourceKey };

/** Default page size of the tournament catalogue, shared by the handler and the
 * documented default so the two cannot drift. */
export const TOURNAMENTS_PAGE_SIZE = 50;

export const regionPath = z.enum(Region).meta({
  description: "Game server region.",
  "x-enum-source": "REGION",
} as EnumMeta);

export const regionParams = z.object({ region: regionPath });

// Param examples live in `PARAM_EXAMPLES` (next-openapi-gen drops `.meta`
// examples on params), so `.meta` here only carries the description.
export const playerLiveParams = z.object({
  region: regionPath,
  nickname: z.string().meta({ description: "Player nickname." }),
});

/** How a player's sessions are bucketed. */
export const playerSessionsQuery = z.object({
  granularity: z
    .enum(SessionGranularity)
    .default(SessionGranularity.Daily)
    .meta({
      description: "Bucket size for the sessions.",
      "x-enum-source": "SESSION_GRANULARITY",
    } as EnumMeta),
});

/**
 * How far back a server population series reads. Named `range` rather than
 * `period`, which the leaderboards already own with a different value set: the
 * doc's defaults and examples are keyed by parameter name across the whole API,
 * so two endpoints sharing a name would have to share its default too.
 */
export const serverStatsQuery = z.object({
  range: z.enum(ServerStatsRange).default(ServerStatsRange.Day).meta({
    description: "How far back the population series reads.",
    "x-enum-source": "SERVER_STATS_RANGE",
  } as EnumMeta),
});

/** A player and one of their vehicles: the Service Record of that pair. */
export const playerTankParams = z.object({
  region: regionPath,
  nickname: z.string().meta({ description: "Player nickname." }),
  slug: z.string().meta({ description: "Tank slug (e.g. is-7)." }),
});

export const clanLiveParams = z.object({
  region: regionPath,
  tag: z.string().meta({ description: "Clan tag." }),
});

export const tankParams = z.object({
  region: regionPath,
  slug: z.string().meta({ description: "Tank slug (e.g. is-7)." }),
});

export const mapParams = z.object({
  region: regionPath,
  slug: z.string().meta({ description: "Map slug (e.g. prokhorovka)." }),
});

export const tournamentParams = z.object({
  region: regionPath,
  id: z.string().meta({ description: "Tournament id." }),
});

export const tournamentTeamParams = z.object({
  region: regionPath,
  id: z.string().meta({ description: "Tournament id." }),
  teamId: z.string().meta({ description: "Team id within that tournament." }),
});

export const tournamentStatusField = z.enum(TournamentStatus).meta({
  description: "Where a tournament is in its lifecycle.",
  "x-enum-source": "TOURNAMENT_STATUS",
} as EnumMeta);

export const tournamentGameModeField = z.enum(TournamentGameMode).meta({
  description: "Battle type a tournament is played in.",
  "x-enum-source": "TOURNAMENT_GAME_MODE",
} as EnumMeta);

export const tournamentBracketTypeField = z.enum(BracketType).meta({
  description: "How a stage's teams are paired up.",
  "x-enum-source": "TOURNAMENT_BRACKET_TYPE",
} as EnumMeta);

export const tournamentTeamStatusField = z.enum(TournamentTeamStatus).meta({
  description: "Where a team stands in the registration flow.",
  "x-enum-source": "TOURNAMENT_TEAM_STATUS",
} as EnumMeta);

/**
 * Which slice of the tournament catalogue to list.
 *
 * `limit`/`offset` are optional rather than `.default()`ed: a Zod default makes
 * the field REQUIRED in the generated types, so the SDK's `list(query?)` would
 * stop accepting a bare call. The defaults live in the handler, and are
 * advertised through `QUERY_PARAM_DEFAULTS` like every other documented default.
 */
export const tournamentsQuery = z.object({
  status: z.enum(TournamentStatus).optional().meta({
    description: "Only tournaments in this lifecycle state.",
    "x-enum-source": "TOURNAMENT_STATUS",
  } as EnumMeta),
  limit: z.coerce.number().int().min(1).max(100).optional().meta({
    description: "How many tournaments to return.",
  }),
  offset: z.coerce.number().int().min(0).optional().meta({
    description: "How many tournaments to skip.",
  }),
});

export const mapModeField = z.enum(MapGameMode).meta({
  description: "Random-battle game mode a map supports.",
  "x-enum-source": "MAP_MODE",
} as EnumMeta);

export const mapCamouflageField = z.enum(MapCamouflage).meta({
  description: "Vehicle camouflage kind the map is skinned with.",
  "x-enum-source": "MAP_CAMOUFLAGE",
} as EnumMeta);

export const mapBattleTypeField = z.enum(BattleType).meta({
  description: "Top-level battle type a map belongs to.",
  "x-enum-source": "MAP_BATTLE_TYPE",
} as EnumMeta);

export const battleResultField = z.enum(BattleResult).meta({
  description: "How the battle ended, as declared by the submitter.",
  "x-enum-source": "BATTLE_RESULT",
} as EnumMeta);

export const battleFormatField = z.enum(BattleFormat).meta({
  description: "Format the battle was played in.",
  "x-enum-source": "BATTLE_FORMAT",
} as EnumMeta);

export const spawnDirectionField = z.enum(SpawnDirection).meta({
  description: "Side of the map a team starts from.",
  "x-enum-source": "SPAWN_DIRECTION",
} as EnumMeta);

export const voterBracketField = z.enum(VoterBracket).meta({
  description:
    "How well the voter plays, cut on account WN8 at the same boundaries the site paints its ratings with.",
  "x-enum-source": "VOTER_BRACKET",
} as EnumMeta);

export const tankRatingAxisField = z.enum(TankRatingAxis).meta({
  description: "An axis a vehicle is rated on.",
  "x-enum-source": "TANK_RATING_AXIS",
} as EnumMeta);

export const tankReviewStatusField = z.enum(TankReviewStatus).meta({
  description: "Where a written opinion stands in moderation.",
  "x-enum-source": "TANK_REVIEW_STATUS",
} as EnumMeta);

export const ratingBlockField = z.enum(RatingBlock).meta({
  description: "Why a signed-in account may not rate this tank yet.",
  "x-enum-source": "RATING_BLOCK",
} as EnumMeta);

export const reviewOutcomeField = z.enum(ReviewOutcome).meta({
  description: "What became of a written opinion attached to a rating.",
  "x-enum-source": "REVIEW_OUTCOME",
} as EnumMeta);

export const ratingConsensusField = z.enum(RatingConsensus).meta({
  description: "How far apart the voters sit, read off the spread.",
  "x-enum-source": "RATING_CONSENSUS",
} as EnumMeta);

/**
 * One community-suggested battle, marked in a video.
 *
 * Shared because four endpoints answer with it (a tank's list, a submitter's
 * own queue, a map's list, the community index) and they differ by which rows
 * they return, never by what a row is.
 */
export const videoBattle = z.object({
  id: z.number().int(),
  /** YouTube id, never a URL: the client builds the embed from it. */
  videoId: z.string(),
  startSeconds: z.number().int().meta({
    description: "Where the battle starts in the video, in seconds.",
  }),
  title: z.string(),
  channelName: z.string(),
  mapName: z.string().nullable(),
  mapSlug: z.string().nullable(),
  mode: mapModeField.nullable(),
  direction: spawnDirectionField.nullable().meta({
    description:
      "Side the player spawned from, derived from the map's own geometry rather than declared.",
  }),
  directionLabel: z.string().nullable(),
  result: battleResultField.nullable(),
  format: battleFormatField,
  teamSize: z.number().int().nullable().meta({
    description:
      "Players per team, from the format where it fixes one and from the submitter otherwise.",
  }),
  tier: z.number().int().nullable().meta({
    description: "Tier the battle was fought at, on the same rule as team size.",
  }),
  clan: z
    .object({
      region: regionPath,
      id: z.number().int(),
      tag: z.string(),
      name: z.string(),
      color: z.string().nullable().meta({
        description: "The clan's own colour, which its tag is rendered in.",
      }),
      emblem: z.string().nullable().meta({
        description: "The clan's emblem, drawn beside its tag.",
      }),
    })
    .nullable()
    .meta({
      description:
        "Clan the battle was played for, resolved from a stored id so a rename cannot strand the credit.",
    }),
  combinedDamage: z.number().int().nullable().meta({
    description:
      "Damage dealt plus assisted, as declared. Only ever set on a random battle.",
  }),
  gameVersion: z.string().nullable().meta({
    description: "Client version at the time the video was approved.",
  }),
});

/**
 * The same battle, named with the vehicle it was played in.
 *
 * Every tank field is nullable: a competitive tactic has no vehicle to name, it
 * is filed under the ground it was fought on. The lists that cross tanks (the
 * community index, a map's own page) carry both kinds, so the shape has to
 * admit both.
 */
export const videoBattleWithTank = videoBattle
  .extend({
    tankId: z.number().int().nullable(),
    tankName: z.string().nullable(),
    tankSlug: z.string().nullable(),
    tankShortName: z.string().nullable(),
    tankTag: z.string().nullable(),
    vehicleTier: z.number().int().nullable().meta({
      description: "The vehicle's tier, as opposed to the battle's.",
    }),
    nation: z.string().nullable(),
    type: z.string().nullable(),
    role: z.string().nullable(),
    isPremium: z.boolean(),
    isReward: z.boolean(),
  })
  .meta({
    id: "CommunityVideo",
    description:
      "A community-suggested battle, with the vehicle it was played in when it was about one.",
  });

export const MIN_QUERY_LENGTH = 3;

export const searchQuery = z.object({
  // Static description (no template literal): next-openapi-gen evaluates `.meta`
  // via AST and drops the whole object if it contains a non-literal expression.
  // The `minLength` from `.min()` already documents the 3-char minimum.
  q: z.string().min(MIN_QUERY_LENGTH).meta({
    description: "Search prefix.",
  }),
});

// The `/api/og/**` routes all return a 1200×630 PNG stats card (not JSON), so
// they document their body with this binary response + `@responseContentType
// image/png`.
export const ogImageResponse = z.string().meta({
  description: "A 1200×630 PNG stats card.",
  format: "binary",
});

// Title/subtitle for the generic text card. Optional: the route falls back to
// site defaults.
export const ogTextQuery = z.object({
  title: z.string().optional().meta({ description: "Card title." }),
  subtitle: z.string().optional().meta({ description: "Card subtitle." }),
});

// Compare inputs are honest arrays in the spec (serialized to `?names=a,b` CSV,
// which the routes parse and the SDK produces from a `string[]`). Shared by the
// data compare endpoints and their OG-image counterparts.
export const compareNamesQuery = z.object({
  names: z.array(z.string()).meta({
    description: "Player nicknames to compare (2 to 4).",
  }),
});

export const compareTagsQuery = z.object({
  tags: z.array(z.string()).meta({
    description: "Clan tags to compare (2 to 4).",
  }),
});

export const compareSlugsQuery = z.object({
  slugs: z.array(z.string()).meta({
    description: "Vehicle slugs to compare (2 to 4).",
  }),
});

export const periodField = z.enum(TopPlayersPeriod).meta({
  description: "Leaderboard time window.",
  example: "overall",
  "x-enum-source": "PLAYER_PERIOD",
} as EnumMeta);

// Clans expose only the lifetime and 30-day rankings (no 24h/7d), so their
// period param is a narrower enum than the player one.
export const clanPeriodField = z.enum(TopClansPeriod).meta({
  description: "Clan leaderboard time window.",
  example: "overall",
  "x-enum-source": "CLAN_PERIOD",
} as EnumMeta);

export const metricField = z.enum(RatingMetric).meta({
  description: "Rating metric the leaderboard is ranked by.",
  "x-enum-source": "METRIC",
} as EnumMeta);

// Leaderboard limits live here (the API contract) and are imported by the route
// handlers, so the doc and the runtime clamp share one source. The player boards
// pull the whole ranking (up to 1000) in one request and paginate client-side,
// like every other table on the site (TablePager / usePagination).
export const TOP_DEFAULT_LIMIT = 10;
export const PLAYERS_TOP_MAX_LIMIT = 1000;
export const CLANS_TOP_MAX_LIMIT = 200;

export function limitField(max: number) {
  // Doc-only schema (handlers clamp the limit manually), so a plain number
  // renders cleanly as an integer param instead of the `object` that
  // `z.coerce.number()` produces in the generated spec.
  // Static description (a `${max}` template literal would make next-openapi-gen
  // drop the whole `.meta`); the schema's min/max already document the range.
  return z.number().int().min(1).max(max).default(TOP_DEFAULT_LIMIT).meta({
    description: "Maximum number of rows to return. Out-of-range values are clamped.",
  });
}

const languageField = z.string().meta({
  description:
    "Two-letter language code. When set, the leaderboard is filtered to players/clans whose clan declares this language (period is ignored: language boards are lifetime WNX).",
});
const strictField = z.enum(["true", "false"]).meta({
  description:
    "With `language`: only count clans that declare exactly this one language.",
});
const withLanguagesField = z.enum(["true", "false"]).meta({
  description:
    "Return the lifetime by-language board (each row carries its inferred languages) without filtering to one language.",
});

export const playersTopQuery = z.object({
  period: periodField.optional(),
  limit: limitField(PLAYERS_TOP_MAX_LIMIT).optional(),
  metric: metricField.optional(),
  language: languageField.optional(),
  strict: strictField.optional(),
  languages: withLanguagesField.optional(),
});

export const clansTopQuery = z.object({
  period: clanPeriodField.optional(),
  limit: limitField(CLANS_TOP_MAX_LIMIT).optional(),
  metric: metricField.optional(),
  language: languageField.optional(),
  strict: strictField.optional(),
  languages: withLanguagesField.optional(),
});

// The Steel Hunter board is a single lifetime ranking, sortable by column.
// Inline literals: locked to `SteelHunterSort` in
// `@unicum.gg/shared/constants/steel-hunter`.
export const steelHunterQuery = z.object({
  limit: limitField(PLAYERS_TOP_MAX_LIMIT).optional(),
  sort: z
    .enum(["hr", "hrb", "battles", "winrate", "survival", "damage"])
    .optional()
    .meta({ description: "Ranking column (default hr)." }),
});

// The Onslaught board is the game's own full ranked standings (every player down
// to the Master cutoff, a few thousand), not a top-N of a huge population, so it
// gets a much higher cap than the WNX/SH boards.
export const ONSLAUGHT_MAX_LIMIT = 60000;

// The Onslaught board is the game's own ranking, served in that fixed rank
// order. `limit` caps the rows; `season` picks a past season (default current).
export const onslaughtQuery = z.object({
  limit: limitField(ONSLAUGHT_MAX_LIMIT).optional(),
  season: z.string().optional().meta({
    description:
      "Season event id to load (default the current season). From the seasons list in the response.",
  }),
});

// next-openapi-gen doesn't serialize `.default()` on enum params, so the doc
// defaults are applied when serving the spec (see `api/openapi.json/route.ts`),
// keyed by query-param name. Sourced from the app constants so they can't drift.
export const QUERY_PARAM_DEFAULTS: Record<string, string> = {
  period: TopPlayersPeriod.Overall,
  metric: DEFAULT_RATING_METRIC,
  granularity: SessionGranularity.Daily,
  range: ServerStatsRange.Day,
  client: TankClient.Live,
  limit: String(TOURNAMENTS_PAGE_SIZE),
  offset: "0",
};

// next-openapi-gen drops `.meta({ example })` on path/query params (it injects a
// literal `example: "example"` placeholder instead), so the examples shown in
// the docs live here and are applied when serving the spec (see
// `api/openapi.json/route.ts`), keyed by parameter name.
//
// Keyed by name means one entry per name across the whole API, so a param whose
// example depends on the endpoint does not belong here: `slug` did, and every
// map endpoint documented the tank example `is-7`. Those advertise their example
// in their own description instead ("Map slug (e.g. prokhorovka).", read back by
// `exampleFromDescription` in `./normalize`), which wins over this table.
export const PARAM_EXAMPLES: Record<string, string> = {
  tag: "FAME",
  nickname: "Animal",
  q: "uni",
};

export const playerSummary = z
  .object({
    account_id: z.number(),
    nickname: z.string(),
    // Lifetime win rate (0..1). Present on the top-players leaderboard rows.
    winrate: z.number().nullable().optional(),
    // Public badges (present on leaderboard/list rows): the owner connected this
    // account on the site, is an active non-anonymous supporter, and/or has a
    // linked Twitch channel.
    is_verified: z.boolean().optional(),
    is_supporter: z.boolean().optional(),
    twitch_login: z.string().nullable().optional(),
    // Tournament honours, for the winner's crest. Counted apart because a
    // featured event and a nightly gold ladder are not the same achievement.
    tournament_wins: z.number().optional(),
    tournament_featured_wins: z.number().optional(),
    tournament_best_title: z.string().nullable().optional(),
  })
  .loose()
  .meta({
    id: "PlayerSummary",
    description: "Player row (additional fields may be present).",
  });

/**
 * A podium position on one of the clan leaderboards. Shared rather than
 * co-located because it rides along with a clan wherever one is returned: the
 * detail payload, the leaderboard rows, search.
 */
export const clanRankBadge = z
  .object({
    board: z.enum(ClanBoard).meta({
      description: "The leaderboard this placing is on.",
      "x-enum-source": "CLAN_BOARD",
    } as EnumMeta),
    rank: z.number().int(),
  })
  .meta({
    id: "ClanRankBadge",
    description:
      "A podium position (rank 1 to 3) the clan currently holds on one leaderboard.",
  });

export const clanSummary = z
  .object({
    clan_id: z.number(),
    tag: z.string(),
    name: z.string(),
    // Battle-weighted mean lifetime win rate (0..1) of the roster.
    winrate: z.number().nullable().optional(),
    badges: z.array(clanRankBadge).optional(),
    // Tournament honours, for the winner's crest beside the tag. Absent rather
    // than zero when the clan has never won one.
    tournament_wins: z.number().optional(),
    tournament_featured_wins: z.number().optional(),
    tournament_best_title: z.string().nullable().optional(),
  })
  .loose()
  .meta({
    id: "ClanSummary",
    description: "Clan row (additional fields may be present).",
  });

