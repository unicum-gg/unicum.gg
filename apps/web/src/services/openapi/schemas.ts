import * as z from "zod";
import {
  DEFAULT_RATING_METRIC,
  RATING_METRICS,
  type RatingMetric,
} from "@unicum.gg/core/constants/rating";
import { REGIONS, type Region } from "@unicum.gg/wargaming/region";
// Imported from the dependency-free `period` module (not the DB-heavy index) so
// loading these schemas never pulls in the leaderboard logic.
import { TopPlayersPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period";

// Single source of truth for the public API surface. These Zod schemas are
// consumed by the route handlers (runtime validation) and by the OpenAPI
// document builder, so the spec can never drift from the code.
//
// Enum values must be passed to `z.enum([...])` as literals: next-openapi-gen
// reads them via static AST analysis and can't resolve an imported array or a
// native enum. To stop those literals from silently drifting, each is locked to
// its source enum by the `Exact<>` guard below (a compile error if they
// diverge). The type-only imports above keep this at zero runtime cost.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export const regionPath = z.enum(["eu", "na", "asia"]).meta({
  description: "Game server region.",
});

export const regionParams = z.object({ region: regionPath });

// Param examples live in `PARAM_EXAMPLES` (next-openapi-gen drops `.meta`
// examples on params), so `.meta` here only carries the description.
export const playerLiveParams = z.object({
  region: regionPath,
  nickname: z.string().meta({ description: "Player nickname." }),
});

export const clanLiveParams = z.object({
  region: regionPath,
  tag: z.string().meta({ description: "Clan tag." }),
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

export const periodField = z.enum(["24h", "7d", "overall"]).meta({
  description: "Leaderboard time window.",
  example: "overall",
});

export const metricField = z.enum(["wn7", "wn8", "wnx"]).meta({
  description: "Rating metric the leaderboard is ranked by.",
});

// The enum literals above are required by next-openapi-gen (static AST), but
// they must mirror their source enums. Two guards keep them honest:
//
// 1. Compile-time: `tsc` errors if a literal diverges from the source enum's
//    value union (catches it at build).
const _enumGuards: [
  Exact<(typeof regionPath.options)[number], `${Region}`>,
  Exact<(typeof periodField.options)[number], `${TopPlayersPeriod}`>,
  Exact<(typeof metricField.options)[number], `${RatingMetric}`>,
] = [true, true, true];
void _enumGuards;

// 2. Runtime: throws when this module loads (dev, `openapi-gen generate`, prod)
//    if a value was added to the source enum without updating the literal.
function assertEnumInSync(
  literal: readonly string[],
  source: readonly string[],
  name: string,
): void {
  const inLiteral = new Set(literal);
  const inSource = new Set(source);
  const missing = source.filter((v) => !inLiteral.has(v));
  const unknown = literal.filter((v) => !inSource.has(v));
  if (missing.length || unknown.length) {
    throw new Error(
      `OpenAPI enum "${name}" is out of sync with its source enum` +
        (missing.length ? `, missing [${missing.join(", ")}]` : "") +
        (unknown.length ? `, unknown [${unknown.join(", ")}]` : ""),
    );
  }
}

assertEnumInSync(regionPath.options, REGIONS, "region");
assertEnumInSync(periodField.options, Object.values(TopPlayersPeriod), "period");
assertEnumInSync(metricField.options, RATING_METRICS, "metric");

// Leaderboard limits live here (the API contract) and are imported by the route
// handlers, so the doc and the runtime clamp share one source.
export const TOP_DEFAULT_LIMIT = 10;
export const PLAYERS_TOP_MAX_LIMIT = 30;
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

export const playersTopQuery = z.object({
  period: periodField.optional(),
  limit: limitField(PLAYERS_TOP_MAX_LIMIT).optional(),
  metric: metricField.optional(),
});

export const clansTopQuery = z.object({
  limit: limitField(CLANS_TOP_MAX_LIMIT).optional(),
  metric: metricField.optional(),
});

// next-openapi-gen doesn't serialize `.default()` on enum params, so the doc
// defaults are applied when serving the spec (see `api/openapi.json/route.ts`),
// keyed by query-param name. Sourced from the app constants so they can't drift.
export const QUERY_PARAM_DEFAULTS: Record<string, string> = {
  period: TopPlayersPeriod.Overall,
  metric: DEFAULT_RATING_METRIC,
};

// next-openapi-gen drops `.meta({ example })` on path/query params (it injects a
// literal `example: "example"` placeholder instead), so the examples shown in
// the docs live here and are applied when serving the spec (see
// `api/openapi.json/route.ts`), keyed by parameter name.
export const PARAM_EXAMPLES: Record<string, string> = {
  tag: "FAME",
  nickname: "Animal",
  q: "uni",
};

const playerSummary = z
  .object({
    account_id: z.number(),
    nickname: z.string(),
  })
  .loose()
  .meta({
    id: "PlayerSummary",
    description: "Player row (additional fields may be present).",
  });

const clanSummary = z
  .object({
    clan_id: z.number(),
    tag: z.string(),
    name: z.string(),
  })
  .loose()
  .meta({
    id: "ClanSummary",
    description: "Clan row (additional fields may be present).",
  });

// Response schemas are PascalCase so the generated component name matches the
// export name (no duplicate lowercase component). The param/query helpers above
// stay lowercase and are dropped from `components` via `excludeSchemas`.
export const PlayerSearchResponse = z.object({
  results: z.array(playerSummary),
});

export const TopPlayersResponse = z.object({
  results: z.array(playerSummary),
  computed_at: z.string().nullable(),
});

export const ClanSearchResponse = z.object({ results: z.array(clanSummary) });

export const TopClansResponse = z.object({
  results: z.array(clanSummary),
  computed_at: z.string().nullable(),
});

// --- Clan detail (GET /api/{region}/clans/{tag}) ---
//
// Field names are camelCase to match the domain types this payload is built
// from (avoiding a fragile snake_case mapping layer over a large, nested
// shape). `z.coerce.date()` on the date fields does double duty: it documents
// them as date-time and the client reuses this schema to parse the response,
// reviving ISO strings back into `Date`s with no hand-written revival list.
// Objects are `.loose()` so additional fields can be added without breaking
// the parse.

const clanMemberPeriodStats = z
  .object({
    battles: z.number(),
    winsPercentage: z.number(),
    damagePerBattle: z.number(),
    expPerBattle: z.number(),
    fragsPerBattle: z.number(),
    battlesPerDay: z.number(),
  })
  .meta({
    id: "ClanMemberPeriodStats",
    description: "A member's aggregate stats over a period.",
  });

const clanMember = z
  .object({
    accountId: z.number(),
    name: z.string(),
    role: z.string(),
    roleLocalized: z.string(),
    roleRank: z.number(),
    daysInClan: z.number(),
    lastBattleTime: z.coerce.date().nullable(),
    personalRating: z.number().nullable(),
    overall: clanMemberPeriodStats.nullable(),
    d28: clanMemberPeriodStats.nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    wn730d: z.number().nullable(),
    wn830d: z.number().nullable(),
    wnx30d: z.number().nullable(),
    battles30d: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "ClanMember",
    description: "A clan member with cached WN7/WN8/WNX ratings.",
  });

const previousClan = z
  .object({
    clanId: z.number(),
    tag: z.string(),
    name: z.string(),
    color: z.string(),
    emblem: z.string().nullable(),
    languages: z.array(z.string()),
    totalCount: z.number(),
    cameFromCount: z.number(),
  })
  .loose()
  .meta({
    id: "PreviousClan",
    description: "A clan that current members previously belonged to.",
  });

const clanEvent = z
  .object({
    type: z.string(),
    createdAt: z.coerce.date(),
    accountId: z.number(),
    accountName: z.string(),
    oldRole: z.string().nullable(),
    newRole: z.string().nullable(),
    oldRank: z.number().nullable(),
    newRank: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "ClanEvent",
    description: "A recent join, leave or role-change event.",
  });

const clanSnapshot = z
  .object({
    takenAt: z.coerce.date(),
    eloT6: z.number().nullable(),
    skirmishBattlesT6: z.number().nullable(),
    skirmishWinsT6: z.number().nullable(),
    eloT8: z.number().nullable(),
    skirmishBattlesT8: z.number().nullable(),
    skirmishWinsT8: z.number().nullable(),
    eloT10: z.number().nullable(),
    skirmishBattlesT10: z.number().nullable(),
    skirmishWinsT10: z.number().nullable(),
    advancesBattlesT10: z.number().nullable(),
    advancesWinsT10: z.number().nullable(),
    gmEloT10: z.number().nullable(),
    gmBattlesT10: z.number().nullable(),
    gmWinsT10: z.number().nullable(),
    gmEloT8: z.number().nullable(),
    gmBattlesT8: z.number().nullable(),
    gmWinsT8: z.number().nullable(),
    gmEloT6: z.number().nullable(),
    gmBattlesT6: z.number().nullable(),
    gmWinsT6: z.number().nullable(),
    gmProvinces: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "ClanSnapshot",
    description: "A point-in-time stronghold and global-map snapshot.",
  });

const clanInfo = z
  .object({
    id: z.number(),
    tag: z.string(),
    name: z.string(),
    color: z.string(),
    emblem: z.string(),
    motto: z.string(),
    descriptionHtml: z.string(),
    createdAt: z.coerce.date(),
    membersCount: z.number(),
    leaderId: z.number(),
    leaderName: z.string(),
    creatorId: z.number(),
    creatorName: z.string(),
    isDisbanded: z.boolean(),
    languages: z.array(z.string()),
  })
  .loose()
  .meta({ id: "ClanInfo", description: "Core clan profile." });

export const ClanDetailResponse = z.object({
  clan: clanInfo,
  members: z.array(clanMember),
  previousClans: z.array(previousClan),
  events: z.array(clanEvent),
  snapshotLatest: clanSnapshot.nullable(),
  snapshotPeriods: z.object({
    h24: clanSnapshot.nullable(),
    d7: clanSnapshot.nullable(),
    d30: clanSnapshot.nullable(),
  }),
});

// --- Clan vehicles (GET /api/{region}/clans/{tag}/vehicles) ---
// Per-tank stats aggregated across all clan members, computed server-side.
// All three ratings are returned so the client can switch the displayed metric
// without another request. Fields are camelCase (see clan detail rationale).

const clanVehicle = z
  .object({
    tankId: z.number(),
    name: z.string(),
    shortName: z.string().nullable(),
    tier: z.number().nullable(),
    nation: z.string().nullable(),
    type: z.string().nullable(),
    isPremium: z.boolean(),
    memberCount: z.number(),
    battles: z.number(),
    avgDamage: z.number().nullable(),
    avgXp: z.number().nullable(),
    winrate: z.number().nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "ClanVehicle",
    description:
      "A tank the clan has played, with battle-weighted averages and WN7/WN8/WNX ratings across all members.",
  });

export const ClanVehiclesResponse = z.object({
  vehicles: z.array(clanVehicle),
});

// --- Player detail (GET /api/{region}/players/{nickname}) ---
// Everything the player page renders, fully computed server-side (the
// encyclopedia and WN8/WNX expected-value tables never leave the server).
// camelCase + `z.coerce.date()` for the same reasons as the clan detail.

export const playerDetailQuery = z.object({
  metric: metricField.optional(),
});

const playerStats = z
  .object({
    battles: z.number(),
    wins: z.number(),
    losses: z.number(),
    draws: z.number(),
    survivedBattles: z.number(),
    frags: z.number(),
    damageDealt: z.number(),
    xp: z.number(),
    spotted: z.number(),
    capturePoints: z.number(),
    droppedCapturePoints: z.number(),
    hits: z.number(),
    shots: z.number(),
    globalRating: z.number(),
    wtr: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "PlayerStats",
    description:
      "Random-battles totals (or a period diff of them) from a snapshot.",
  });

const periodValues = z
  .object({
    total: z.number().nullable(),
    h24: z.number().nullable(),
    d7: z.number().nullable(),
    d30: z.number().nullable(),
  })
  .meta({
    id: "PeriodValues",
    description: "One derived value per column: lifetime, 24h, 7d, 30d.",
  });

const playerDerivedStats = z
  .object({
    tier: periodValues,
    trackDamage: periodValues,
    spottingDamage: periodValues,
    assistingDamage: periodValues,
    combinedDamage: periodValues,
    wn7: periodValues,
    wn8: periodValues,
    wnx: periodValues,
  })
  .loose()
  .meta({
    id: "PlayerDerivedStats",
    description:
      "Per-tank-breakdown derivations: average tier, assistance damages and WN7/WN8/WNX per column.",
  });

const playerVehicle = z
  .object({
    tankId: z.number(),
    name: z.string(),
    shortName: z.string().nullable(),
    tag: z.string().nullable(),
    tier: z.number().nullable(),
    nation: z.string().nullable(),
    type: z.string().nullable(),
    isPremium: z.boolean(),
    mastery: z.number().nullable(),
    battles: z.number(),
    avgDamage: z.number().nullable(),
    avgXp: z.number().nullable(),
    winrate: z.number().nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "PlayerVehicle",
    description:
      "A tank the player has battles in, with per-battle averages and WN7/WN8/WNX ratings.",
  });

const liftDragRow = z
  .object({
    tankId: z.number(),
    name: z.string(),
    tag: z.string(),
    type: z.string(),
    tier: z.number(),
    isPremium: z.boolean(),
    battles: z.number(),
    rating: z.number(),
    removalDelta: z.number(),
  })
  .loose()
  .meta({
    id: "LiftDragRow",
    description:
      "A tank whose removal would move the overall rating by removalDelta (negative = it lifts the rating, positive = it drags it).",
  });

const ratingHistoryPoint = z
  .object({
    day: z.string(),
    lifetime: z.number().nullable(),
    session: z.number().nullable(),
  })
  .meta({
    id: "RatingHistoryPoint",
    description:
      "Daily rating sample: lifetime value plus the per-session value computed from that day's battles.",
  });

const clanStint = z
  .object({
    clan: z
      .object({
        id: z.number(),
        tag: z.string(),
        name: z.string(),
        color: z.string(),
        emblem: z.string(),
        languages: z.array(z.string()),
      })
      .loose(),
    joinedAt: z.coerce.date(),
    leftAt: z.coerce.date().nullable(),
    role: z.string(),
    roleLocalized: z.string(),
  })
  .loose()
  .meta({
    id: "ClanStint",
    description: "A period of membership in one clan.",
  });

const playerClanHistory = z
  .object({
    currentStint: clanStint.nullable(),
    pastStints: z.array(clanStint),
    totalClans: z.number(),
    timeInClansSeconds: z.number(),
  })
  .loose()
  .meta({
    id: "PlayerClanHistory",
    description: "Current and past clan memberships.",
  });

const strongholdStats = z
  .object({
    battles: z.number(),
    wins: z.number(),
    losses: z.number(),
    draws: z.number(),
    survivedBattles: z.number(),
    frags: z.number(),
    damageDealt: z.number(),
    spotted: z.number(),
    capturePoints: z.number(),
    droppedCapturePoints: z.number(),
    battleAvgXp: z.number(),
  })
  .loose()
  .meta({
    id: "StrongholdStats",
    description: "Totals for one non-random game mode.",
  });

const strongholdMode = z
  .object({
    current: strongholdStats.nullable(),
    periods: z.object({
      h24: strongholdStats.nullable(),
      d7: strongholdStats.nullable(),
      d30: strongholdStats.nullable(),
    }),
  })
  .meta({
    id: "StrongholdMode",
    description: "One game mode's totals plus 24h/7d/30d period diffs.",
  });

export const PlayerDetailResponse = z.object({
  player: z
    .object({
      accountId: z.number(),
      nickname: z.string(),
      createdAt: z.coerce.date(),
      lastBattleAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
    })
    .loose(),
  metric: metricField,
  current: playerStats,
  periods: z.object({
    h24: playerStats.nullable(),
    d7: playerStats.nullable(),
    d30: playerStats.nullable(),
  }),
  derived: playerDerivedStats,
  vehicles: z.array(playerVehicle),
  liftDrag: z
    .object({ lift: z.array(liftDragRow), drag: z.array(liftDragRow) })
    .nullable(),
  ratingHistory: z.array(ratingHistoryPoint),
  clanHistory: playerClanHistory,
  strongholds: z.object({
    skirmish: strongholdMode,
    fortified: strongholdMode,
    epic: strongholdMode,
    ranked: strongholdMode,
    fallout: strongholdMode,
    cwAbsolute: strongholdMode,
    cwChampion: strongholdMode,
    cwMiddle: strongholdMode,
  }),
});

export const HealthResponse = z.object({
  status: z.string().meta({ example: "ok" }),
});
