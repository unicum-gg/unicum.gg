// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";

/**
 * One row of the Marks of Excellence board.
 *
 * The tier columns the board draws are served ready-made beside the whole
 * tally, so a client draws the two it shows without knowing that Postgres
 * subscripts an array from one and JavaScript from zero. `marks3_by_tier` is
 * there for the rest of the split, index `i` holding tier `i + 1`, and it is as
 * long as the highest tier the player holds a three-mark gun at.
 */
export const marksSummary = z
  .object({
    account_id: z.number(),
    nickname: z.string(),
    clan_tag: z.string().nullable(),
    clan_color: z.string().nullable(),
    battles: z.number(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    marks3: z.number().meta({
      description: "Guns carrying three Marks of Excellence, every tier.",
    }),
    marks3_by_tier: z.array(z.number()).meta({
      description:
        "Three-mark guns per tier, index 0 holding tier 1. Every tier column the board draws is read out of this. Shorter than the tier count when the player holds none at the top tiers.",
    }),
    marks2: z.number(),
    marks1: z.number(),
    known: z.number().meta({
      description:
        "Vehicles a mark level was read for on this account, which is the row's own denominator: three marks mean more on a garage of forty than on one of nine hundred.",
    }),
    measured_at: z.string().datetime().meta({
      description:
        "The newest observation these counts were taken from. Exact when the marks were read from the portal, and an upper bound for an account seeded from stored snapshots, since the bulk pipeline carries the last known marks forward without re-reading them.",
    }),
    languages: z.array(z.string()).meta({
      description:
        "Languages inferred from the account's clan history, dominant first. Empty for an account we hold no history for.",
    }),
    is_verified: z.boolean().optional(),
    is_supporter: z.boolean().optional(),
    twitch_login: z.string().nullable().optional(),
    tournament_wins: z.number().optional(),
    tournament_featured_wins: z.number().optional(),
    tournament_best_title: z.string().nullable().optional(),
    onslaught_best_tier: z.string().nullable().optional(),
    onslaught_best_rank: z.number().nullable().optional(),
    onslaught_seasons: z.number().optional(),
  })
  .meta({
    id: "MarksSummary",
    description: "Marks of Excellence leaderboard row.",
  });

/** One language present on the board, with how many accounts it holds. */
export const marksLanguageStats = z
  .object({
    code: z.string(),
    total: z.number(),
    strict: z.number().meta({
      description:
        "Accounts whose inferred set is exactly this language, with no co-dominant second one.",
    }),
  })
  .meta({ id: "MarksLanguageStats" });

/**
 * What the board is drawn from.
 *
 * Served rather than left implicit because the ranking is not of the whole
 * region and saying so is the honest part. Marks come from the WoT portal at
 * about one request a second per region, so they are only read when somebody
 * looks a profile up: `measured` is the accounts whose garage we have read at
 * all and `tracked` the accounts that clear the board's battle floor, so the
 * gap between them is the board's blind spot.
 */
export const marksCoverage = z
  .object({
    ranked: z.number().meta({
      description: "Accounts holding at least one three-mark gun.",
    }),
    measured: z.number(),
    tracked: z.number(),
    min_battles: z.number().meta({
      description: "Battles an account needs before it is ranked here.",
    }),
    newest: z.string().datetime().nullable(),
    oldest: z.string().datetime().nullable(),
  })
  .meta({ id: "MarksCoverage" });

/** Response of `GET /{region}/players/marks`. */
export const PlayerMarksResponse = z.object({
  results: z.array(marksSummary),
  // The tiers anybody ranked here holds a three-mark gun at, ascending, which
  // is the set of columns worth drawing. Served rather than assumed, because
  // which tiers the game has is Wargaming's to decide and a client that kept
  // its own list would quietly stop showing one the day they add it.
  tiers: z.array(z.number()),
  // The chips the board's language filter draws, counted over the very rows the
  // board ranks, so a chip saying 240 and a board showing 240 cannot disagree.
  // Carried here rather than on an endpoint of its own for that reason: two
  // calls would be two populations the moment either one's floor moved.
  languages: z.array(marksLanguageStats),
  coverage: marksCoverage,
});
