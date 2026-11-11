// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
//
// Every sub-schema here is named after this endpoint rather than after what it
// holds: the generator resolves a schema's local consts by NAME across files, so
// a bare `entry` or `row` would silently merge with another endpoint's.
import { z } from "zod";
import {
  ManeuversBoardKind,
  ManeuversOrder,
  ManeuversSort,
} from "@unicum.gg/shared";
import { clanRankBadge, type EnumMeta } from "@/services/openapi/schemas";

export const maneuversQuery = z.object({
  board: z
    .enum(ManeuversBoardKind)
    .optional()
    .meta({
      description:
        "The board to page through. Omitted, both are served, each sliced by the same `offset` and `limit`; named, the other one comes back empty.",
      "x-enum-source": "MANEUVERS_BOARD",
    } as EnumMeta),
  limit: z.coerce.number().int().min(1).max(1000).optional().meta({
    description: "Rows per board, 1-1000 (default 100).",
  }),
  offset: z.coerce.number().int().min(0).optional().meta({
    description:
      "Rows to skip on each board, after searching and ordering (default 0). The whole board is reachable, not only its first rows.",
  }),
  sort: z
    .enum(ManeuversSort)
    .optional()
    .meta({
      description:
        "The column the boards are ordered on (default `fame-points`, the board's own order). `gain` and `move` are the last 24 hours.",
      "x-enum-source": "MANEUVERS_SORT",
    } as EnumMeta),
  order: z
    .enum(ManeuversOrder)
    .optional()
    .meta({
      description:
        "Direction of `sort` (default `desc`). Rows with no figure on the sorted column come last either way.",
      "x-enum-source": "MANEUVERS_ORDER",
    } as EnumMeta),
  range: z
    .enum(ManeuversSort)
    .optional()
    .meta({
      description:
        "The column `min` and `max` bound. A row with no figure on it (a 24h move before the captures reach back a day) is left out.",
      "x-enum-source": "MANEUVERS_SORT",
    } as EnumMeta),
  min: z.coerce.number().optional().meta({
    description: "Lowest value kept on the `range` column, inclusive.",
  }),
  max: z.coerce.number().optional().meta({
    description: "Highest value kept on the `range` column, inclusive.",
  }),
  q: z.string().optional().meta({
    description:
      "Case-insensitive search: a player's nickname, or a clan's tag or name. Rows keep their real place.",
  }),
  edition: z.string().optional().meta({
    description:
      "The edition to read, by its identifier (an `eventName` from `editions`). Defaults to the newest edition recorded.",
  }),
});

const maneuversEditionRef = z
  .object({
    eventName: z.string().meta({
      description:
        "The edition's identifier, e.g. `stronghold_event_2026_autumn`: its year and season.",
    }),
    available: z.boolean().meta({
      description:
        "Whether its standings were recorded. The source keeps no history, so an edition nobody captured while it ran is listed but empty.",
    }),
  })
  .meta({
    id: "ManeuversEditionRef",
    description: "One edition of the event, recorded or not.",
  });

const maneuversEdition = z
  .object({
    eventName: z.string().meta({
      description:
        "The edition's own identifier, e.g. the autumn 2026 one. Stable for the whole edition, and what every other row is keyed by.",
    }),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    vehicleLevels: z.array(z.number()).meta({
      description: "Tiers the edition is played at.",
    }),
    tankRewardPositions: z.number().nullable().meta({
      description:
        "How many places on the player board are rewarded with a vehicle. Set per region and changed between editions.",
    }),
    clanGoldPositions: z.number().nullable().meta({
      description:
        "How many places on the clan board are rewarded with gold from the clan treasury.",
    }),
    accountBondsPercent: z.number().nullable().meta({
      description:
        "Share of the personal board, in percent, whose places earn bonds (75 on the autumn 2026 edition).",
    }),
    clanBondsPercent: z.number().nullable().meta({
      description:
        "Share of the clan board, in percent, whose members get a bond multiplier above one (50 on the autumn 2026 edition).",
    }),
  })
  .meta({
    id: "ManeuversEdition",
    description: "The edition being run, and what it rewards.",
  });

const maneuversStanding = z
  .object({
    capturedAt: z.string().meta({
      description:
        "When the source last recomputed both boards. Not when we read them: two reads between two recomputations describe the same instant.",
    }),
    playerCount: z.number(),
    clanCount: z.number(),
    tankCutoffPoints: z.number().nullable().meta({
      description:
        "Fame Points held by the player at the last rewarded place: what it currently costs to hold a vehicle place. Null before the board is deep enough to have one.",
    }),
    clanGoldCutoffPoints: z.number().nullable().meta({
      description:
        "Fame Points held by the clan at the last gold-rewarded place.",
    }),
    topPlayerPoints: z.number().nullable(),
    topClanPoints: z.number().nullable(),
  })
  .meta({
    id: "ManeuversStanding",
    description:
      "Both boards as a whole at one instant: how many hold a place, and what a rewarded place costs.",
  });

export const maneuversPlayerEntry = z
  .object({
    place: z.number(),
    accountId: z.number(),
    nickname: z.string().nullable(),
    clanId: z.number().nullable(),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable().meta({
      description:
        "The clan's brand colour, so the tag reads in it. Null for a clan we have never crawled.",
    }),
    famePoints: z.number().meta({
      description: "The ranking metric, cumulative over the edition.",
    }),
    gain24h: z.number().nullable().meta({
      description:
        "Fame Points gained over the last 24 hours, measured between two captures a day apart. Null until the edition's captures reach back a day.",
    }),
    placeChange24h: z.number().nullable().meta({
      description:
        "Places climbed over the last 24 hours, negative when the player fell. Null when they held no place a day ago, or the captures do not reach back that far.",
    }),
    victories: z.number(),
    defeats: z.number(),
    // The public crests, attached at the API boundary (see the player badge
    // resolver). Present on every row with falsy defaults, like the other
    // leaderboards, so the client reads them without a per-field guard.
    isVerified: z.boolean(),
    isSupporter: z.boolean(),
    twitchLogin: z.string().nullable(),
    tournamentWins: z.number(),
    tournamentFeaturedWins: z.number(),
    tournamentBestTitle: z.string().nullable(),
    onslaughtBestTier: z.string().nullable(),
    onslaughtBestRank: z.number().nullable(),
    onslaughtSeasons: z.number(),
  })
  .meta({
    id: "ManeuversPlayerEntry",
    description: "One player on the Maneuvers board.",
  });

const maneuversClanEntry = z
  .object({
    place: z.number(),
    clanId: z.number(),
    tag: z.string().nullable(),
    name: z.string().nullable(),
    color: z.string().nullable().meta({
      description: "The clan's brand colour. Null for a clan we have never crawled.",
    }),
    emblem: z.string().nullable().meta({
      description: "The clan's emblem URL, or empty/null when we hold none.",
    }),
    famePoints: z.number(),
    gain24h: z.number().nullable().meta({
      description:
        "Fame Points gained over the last 24 hours. Null until the edition's captures reach back a day.",
    }),
    placeChange24h: z.number().nullable().meta({
      description:
        "Places climbed over the last 24 hours, negative when the clan fell. Null when it held no place a day ago, or the captures do not reach back that far.",
    }),
    victories: z.number(),
    defeats: z.number(),
    badges: z.array(clanRankBadge).optional().meta({
      description:
        "Leaderboard placings the clan currently holds, best rank first. Omitted when it holds none.",
    }),
  })
  .meta({
    id: "ManeuversClanEntry",
    description: "One clan on the Maneuvers board.",
  });

// No `.meta({ id })` here, unlike the sub-schemas above: the generator names a
// component after the exported const, so declaring the same id again conflicts
// with it and the whole `.meta` is dropped.
export const ManeuversBoardResponse = z
  .object({
    editions: z.array(maneuversEditionRef).meta({
      description:
        "Every edition the event has run, newest first, flagged with whether we hold its standings.",
    }),
    edition: maneuversEdition.nullable().meta({
      description:
        "The edition served. Null when the requested one was never recorded, or when the region holds none.",
    }),
    standing: maneuversStanding.nullable().meta({
      description:
        "Null before the edition opens, when neither board carries anybody yet.",
    }),
    players: z.array(maneuversPlayerEntry),
    clans: z.array(maneuversClanEntry),
    totals: z
      .object({
        players: z.number(),
        clans: z.number(),
      })
      .meta({
        description:
          "Rows matching the query on each board before paging: the whole board without `q` or a range, the matches with them.",
      }),
  })
  .meta({
    description:
      "One Maneuvers edition for a region: its frame, both boards, and what a rewarded place costs right now.",
  });
