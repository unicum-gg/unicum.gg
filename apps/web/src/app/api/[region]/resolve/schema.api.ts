// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { MAX_IDS_PER_KIND } from "@unicum.gg/core/resolve";
import { MAX_VEHICLE_PAIRS } from "@unicum.gg/core/players/vehicle-records";
import { LanguageSource, TankBattleMode } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

/**
 * Query of `GET /{region}/resolve`.
 *
 * Three optional lists: a caller holding only a detachment list sends only
 * `tags`. Ids rather than nicknames, because that is what the client hands the
 * caller (a roster row carries `dbID` and `clanDBID`) and a Flash roster does
 * not always carry a displayable name at all.
 *
 * `tags` is the exception and takes the clan tag, because the one roster that
 * carries no clan id is the Stronghold detachment list, which is the WGSH web
 * app in the embedded browser and prints the tag alone.
 *
 * The cap is written out here because it cannot be computed into a description:
 * next-openapi-gen reads `.meta` off the AST and drops the whole object when it
 * is not an inline literal. `MAX_IDS_PER_KIND` is the only value enforced, and
 * the guard below fails the build if the prose and it part ways.
 */
export const resolveQuery = z.object({
  players: z
    .array(z.number())
    .optional()
    .meta({ description: "Account ids. Up to 100." }),
  clans: z
    .array(z.number())
    .optional()
    .meta({ description: "Clan ids. Up to 100." }),
  tags: z
    .array(z.string())
    .optional()
    .meta({ description: "Clan tags, case-insensitive. Up to 100." }),
  vehicles: z
    .array(z.string())
    .optional()
    .meta({
      description:
        "`<account id>:<vehicle id>` pairs, up to 60. Each one is answered in `vehicles` with what that account has done on that vehicle. The vehicle id is Wargaming's `tank_id`, which is the game client's own compact descriptor, so a client reads it off the roster it is drawing.",
    }),
  mode: z
    .enum(TankBattleMode)
    .optional()
    .meta({
      description:
        "Which mode the `vehicles` figures should cover. Omitted, they cover every mode together. Frontline, Onslaught and Steel Hunter are absent on purpose: Wargaming publishes no per-vehicle statistics for them at all, so a client in one of those battles omits this and reads the whole record.",
      "x-enum-source": "TANK_BATTLE_MODE",
    } as EnumMeta),
});

const ratingWindow = z
  .object({
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    pr: z.number().nullable().meta({
      description:
        "Personal Rating, Wargaming's own account figure. Always null on `recent`: an account figure has no 30-day window.",
    }),
    wtr: z.number().nullable().meta({
      description:
        "World of Tanks Rating, Wargaming's own account figure. Always null on `recent`, for the same reason.",
    }),
    battles: z.number().nullable(),
    winrate: z.number().nullable().meta({
      description:
        "Percentage, 0 to 100, on the same scale `/ratings/scales` publishes. Null when the window holds no battles, which is not a win rate of zero, and null on `recent` for an account whose wins over the window have not been computed yet: that figure is written on an account's next refresh and was introduced after the ratings beside it, so a recent `battles` with a null `winrate` means not yet rather than none.",
    }),
  })
  .meta({
    id: "RatingWindow",
    description:
      "One window's ratings. Both halves come from the same pass over the same battles, so the win rate describes exactly the games that produced the rating beside it.",
  });

const languageFields = {
  languages: z.array(z.string()).meta({
    description: "Two-letter language codes. Empty when we hold none.",
  }),
  countries: z.array(z.string().nullable()).meta({
    description:
      "Flag code per language, aligned index for index with `languages`, null where no flag is published. Not an ISO country code: `en` is `GB-UKM` on EU and `US` on NA/ASIA.",
  }),
  languageSource: z
    .enum(LanguageSource)
    .nullable()
    .meta({
      description:
        "Where the languages came from: `declared` (the clan owner set them), `inferred` (weighted over the account's clan history, the same answer the player page shows) or `clan` (no clan history for this account, so their current clan's declared set stood in). Null when we hold no language.",
      "x-enum-source": "LANGUAGE_SOURCE",
    } as EnumMeta),
};

const resolvedPlayer = z
  .object({
    nickname: z.string(),
    clan: z
      .object({ id: z.number(), tag: z.string(), color: z.string() })
      .nullable()
      .meta({ description: "Current clan, with the colour the site paints the tag." }),
    ...languageFields,
    ratings: z.object({ total: ratingWindow, recent: ratingWindow }).meta({
      description: "Lifetime, and the last 30 days.",
    }),
    updatedAt: z.date().meta({
      description: "When this account was last refreshed from Wargaming.",
    }),
  })
  .meta({ id: "ResolvedPlayer", description: "One player, by account id." });

const resolvedClan = z
  .object({
    tag: z.string(),
    name: z.string(),
    color: z.string(),
    membersCount: z.number(),
    ...languageFields,
    ratings: z
      .object({
        total: ratingWindow,
        recent: ratingWindow,
        avgWinrate: z.number().nullable().meta({
          description:
            "The roster's battle-weighted lifetime win rate, the same number as `total.winrate`, under the name the clan page gives it.",
        }),
      })
      .meta({ description: "Aggregated over the clan's own roster, battle-weighted." }),
    updatedAt: z.date().nullable().meta({
      description: "When this clan was last fully refreshed.",
    }),
  })
  .meta({ id: "ResolvedClan", description: "One clan, by clan id." });

/**
 * Response of `GET /{region}/resolve`.
 *
 * Keyed by what was asked for, so a caller pairs entries back to its own roster
 * rows without relying on an order. An id we hold nothing for is absent; an
 * entity we hold but have no language for is present with empty `languages` and
 * a null `languageSource`, which is the difference between "unknown" and
 * "nothing to say".
 */
const resolvedVehicle = z
  .object({
    accountId: z.number(),
    tankId: z.number(),
    scope: z.enum(["mode", "overall"]).meta({
      description:
        "`mode` when the figures cover the mode asked for, `overall` when they cover every mode together, which is the answer when no mode was asked for.",
    }),
    mode: z
      .enum(TankBattleMode)
      .nullable()
      .meta({
        description: "The mode the figures cover, null when they cover all of them.",
        "x-enum-source": "TANK_BATTLE_MODE",
      } as EnumMeta),
    battles: z.number(),
    winrate: z.number().nullable().meta({
      description: "Percentage, 0 to 100. Null when the scope holds no battles.",
    }),
    avgDamage: z.number().nullable(),
    avgXp: z.number().nullable(),
    survival: z.number().nullable().meta({
      description:
        "Percentage of battles survived. Null where the source does not count them, which is the oldest vehicle snapshots.",
    }),
    ratings: z
      .object({
        wn7: z.number().nullable(),
        wn8: z.number().nullable(),
        wnx: z.number().nullable(),
      })
      .meta({
        description:
          "The three WN ratings for these battles alone. All null outside Random Battles and the whole record: the expected values they are built against are measured on Random Battles, so running another mode's counters through them would produce a number that looks like a rating and is not. PR and WTR have no per-vehicle value at all, which is why a per-vehicle reader falls back to a WN rating.",
      }),
    updatedAt: z.date().nullable().meta({
      description: "When the fetch these counters came from landed.",
    }),
  })
  .meta({
    id: "ResolvedVehicle",
    description:
      "What one account has done on one vehicle. Keyed by the pair rather than nested under the player, because the same account can be asked about on two vehicles.",
  });

export const ResolveResponse = z.object({
  players: z.record(z.string(), resolvedPlayer),
  clans: z.record(z.string(), resolvedClan),
  tags: z.record(z.string(), z.number()).meta({
    description:
      "Tag to clan id, echoing back the tag as it was written. The clan itself is in `clans`, so a detachment list costs one request rather than one lookup per row and then a second request.",
  }),
  vehicles: z.array(resolvedVehicle).meta({
    description:
      "One entry per `vehicles` pair we hold an answer for. Empty when none was asked for. A pair whose account or vehicle we hold nothing for is absent rather than present with zeroes: never played is not played badly.",
  }),
});

/** Drift guard for the four places the cap is spelled out for a reader: the
 * three descriptions above and the route's `@description`. Changing
 * `MAX_IDS_PER_KIND` fails this line, which names them. */
export type DocumentedMaxIdsInSync = typeof MAX_IDS_PER_KIND extends 100
  ? true
  : "MAX_IDS_PER_KIND moved: update the three `Up to 100` descriptions above and the route's @description";
export const documentedMaxIdsInSync: DocumentedMaxIdsInSync = true;

/** The same guard for the pair ceiling, which `vehicles` spells out above. */
export type DocumentedMaxVehiclesInSync =
  typeof MAX_VEHICLE_PAIRS extends 60
    ? true
    : "MAX_VEHICLE_PAIRS moved: update the `up to 60` in the `vehicles` description above";
export const documentedMaxVehiclesInSync: DocumentedMaxVehiclesInSync = true;
