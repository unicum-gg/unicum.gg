import * as z from "zod";
import {
  BattleType,
  ClanBoard,
  DEFAULT_RATING_METRIC,
  MapCamouflage,
  MapGameMode,
  RatingMetric,
} from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
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
type EnumMeta = z.core.GlobalMeta & { "x-enum-source": EnumSourceKey };

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
    // Public badges (present on leaderboard/list rows): the owner connected this
    // account on the site, is an active non-anonymous supporter, and/or has a
    // linked Twitch channel.
    is_verified: z.boolean().optional(),
    is_supporter: z.boolean().optional(),
    twitch_login: z.string().nullable().optional(),
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
    badges: z.array(clanRankBadge).optional(),
  })
  .loose()
  .meta({
    id: "ClanSummary",
    description: "Clan row (additional fields may be present).",
  });

