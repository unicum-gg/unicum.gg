import * as z from "zod";
import {
  DEFAULT_RATING_METRIC,
  RATING_METRICS,
  type RatingMetric,
} from "@unicum.gg/core/constants/rating";
import { REGIONS, type Region } from "@unicum.gg/wargaming/region";
// Imported from the dependency-free `period` modules (not the DB-heavy index)
// so loading these schemas never pulls in the leaderboard logic.
import { TopPlayersPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period";
import { TopClansPeriod } from "@unicum.gg/core/wargaming/wot/clans/top/period";

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

export const tankParams = z.object({
  region: regionPath,
  slug: z.string().meta({ description: "Tank slug (e.g. is-7)." }),
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

export const periodField = z.enum(["24h", "7d", "30d", "overall"]).meta({
  description: "Leaderboard time window.",
  example: "overall",
});

// Clans expose only the lifetime and 30-day rankings (no 24h/7d), so their
// period param is a narrower enum than the player one.
export const clanPeriodField = z.enum(["overall", "30d"]).meta({
  description: "Clan leaderboard time window.",
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
  Exact<(typeof clanPeriodField.options)[number], `${TopClansPeriod}`>,
  Exact<(typeof metricField.options)[number], `${RatingMetric}`>,
] = [true, true, true, true];
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
assertEnumInSync(
  clanPeriodField.options,
  Object.values(TopClansPeriod),
  "clan period",
);
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
  period: clanPeriodField.optional(),
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
  slug: "is-7",
  q: "uni",
};

export const playerSummary = z
  .object({
    account_id: z.number(),
    nickname: z.string(),
  })
  .loose()
  .meta({
    id: "PlayerSummary",
    description: "Player row (additional fields may be present).",
  });

export const clanSummary = z
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

