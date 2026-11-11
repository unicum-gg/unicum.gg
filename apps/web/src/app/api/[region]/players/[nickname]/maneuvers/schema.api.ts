// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
//
// Sub-schemas are named after this endpoint: the generator resolves a schema's
// local consts by NAME across files, so a bare `edition` would merge with
// another endpoint's.
import { z } from "zod";

const playerManeuversEdition = z
  .object({
    eventName: z.string().meta({
      description: "The edition's identifier, e.g. `stronghold_event_2026_autumn`.",
    }),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    place: z.number().meta({
      description:
        "The player's place: the live one on the edition being played, the last recorded on one that ended.",
    }),
    famePoints: z.number(),
    ranked: z.number().nullable().meta({
      description: "How many players held a place on the board at its last capture.",
    }),
    rewardPositions: z.number().nullable().meta({
      description:
        "How many places win the vehicle on this edition and server, so `place <= rewardPositions` is a vehicle.",
    }),
    clanId: z.number().nullable(),
    clanTag: z.string().nullable(),
  })
  .meta({
    id: "PlayerManeuversEdition",
    description: "Where the player stood on one edition's board.",
  });

const playerManeuversCurrent = z
  .object({
    eventName: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    place: z.number(),
    famePoints: z.number(),
    ranked: z.number().nullable(),
    rewardPositions: z.number().nullable(),
    clanId: z.number().nullable(),
    clanTag: z.string().nullable(),
    gain24h: z.number().nullable().meta({
      description:
        "Fame Points gained over the last 24 hours. Null until the edition's captures reach back a day.",
    }),
    placeChange24h: z.number().nullable().meta({
      description:
        "Places climbed over the last 24 hours, negative when the player fell. Null when they held no place a day ago.",
    }),
  })
  .meta({
    id: "PlayerManeuversCurrent",
    description:
      "The player's row on the newest edition (fields as on `PlayerManeuversEdition`), with the day's move.",
  });

const playerManeuversLatest = z
  .object({
    eventName: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
  })
  .meta({
    id: "PlayerManeuversLatest",
    description: "The newest edition recorded on the server.",
  });

const playerManeuversPoint = z
  .object({
    t: z.number().meta({ description: "Capture instant, epoch seconds." }),
    place: z.number(),
    famePoints: z.number(),
  })
  .meta({
    id: "PlayerManeuversPoint",
    description: "One recorded move of the player through the edition.",
  });

// No `.meta({ id })` here: the generator names a component after the exported
// const, and declaring the same id again drops the whole `.meta`.
export const PlayerManeuversResponse = z
  .object({
    accountId: z.number(),
    nickname: z.string(),
    latest: playerManeuversLatest.nullable().meta({
      description:
        "The newest edition on the server, whether or not the player is on it. Null when none was ever recorded.",
    }),
    current: playerManeuversCurrent.nullable().meta({
      description: "Null when the player holds no place on the newest edition.",
    }),
    history: z.array(playerManeuversPoint).meta({
      description:
        "The player's climb through the newest edition, oldest first: one point per capture that moved them, so a gap means they did not move.",
    }),
    editions: z.array(playerManeuversEdition).meta({
      description: "Every edition the player held a place on, newest first.",
    }),
  })
  .meta({
    description:
      "A player's Maneuvers record, from our own capture of the event's boards.",
  });
