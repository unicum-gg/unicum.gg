// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
//
// Every sub-schema here is named after this endpoint rather than after what it
// holds: the generator resolves a schema's local consts by NAME across files, so
// a bare `entry` or `row` would silently merge with another endpoint's.
import { z } from "zod";

export const maneuversQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().meta({
    description: "Rows per board, 1-1000 (default 100).",
  }),
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

const maneuversPlayerEntry = z
  .object({
    place: z.number(),
    accountId: z.number(),
    nickname: z.string().nullable(),
    clanId: z.number().nullable(),
    clanTag: z.string().nullable(),
    famePoints: z.number().meta({
      description: "The ranking metric, cumulative over the edition.",
    }),
    victories: z.number(),
    defeats: z.number(),
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
    famePoints: z.number(),
    victories: z.number(),
    defeats: z.number(),
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
    edition: maneuversEdition.nullable().meta({
      description: "Null when no edition has ever been recorded for the region.",
    }),
    standing: maneuversStanding.nullable().meta({
      description:
        "Null before the edition opens, when neither board carries anybody yet.",
    }),
    players: z.array(maneuversPlayerEntry),
    clans: z.array(maneuversClanEntry),
  })
  .meta({
    description:
      "The current Maneuvers edition for a region: its frame, both boards, and what a rewarded place costs right now.",
  });
