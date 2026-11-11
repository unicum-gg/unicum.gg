// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
//
// Sub-schemas are named after this endpoint: the generator resolves a schema's
// local consts by NAME across files.
import { z } from "zod";
import { maneuversPlayerEntry } from "@/app/api/[region]/maneuvers/schema.api";

const clanManeuversEdition = z
  .object({
    eventName: z.string().meta({
      description: "The edition's identifier, e.g. `stronghold_event_2026_autumn`.",
    }),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    place: z.number().meta({
      description:
        "The clan's place: the live one on the edition being played, the last recorded on one that ended.",
    }),
    famePoints: z.number(),
    ranked: z.number().nullable().meta({
      description: "How many clans held a place on the board at its last capture.",
    }),
    rewardPositions: z.number().nullable().meta({
      description:
        "How many places win gold on this edition and server, so `place <= rewardPositions` is gold.",
    }),
  })
  .meta({
    id: "ClanManeuversEdition",
    description: "Where the clan stood on one edition's board.",
  });

const clanManeuversCurrent = z
  .object({
    eventName: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    place: z.number(),
    famePoints: z.number(),
    ranked: z.number().nullable(),
    rewardPositions: z.number().nullable(),
    gain24h: z.number().nullable().meta({
      description:
        "Fame Points gained over the last 24 hours. Null until the edition's captures reach back a day.",
    }),
    placeChange24h: z.number().nullable().meta({
      description:
        "Places climbed over the last 24 hours, negative when the clan fell. Null when it held no place a day ago.",
    }),
  })
  .meta({
    id: "ClanManeuversCurrent",
    description:
      "The clan's row on the newest edition (fields as on `ClanManeuversEdition`), with the day's move.",
  });

const clanManeuversLatest = z
  .object({
    eventName: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
  })
  .meta({
    id: "ClanManeuversLatest",
    description: "The newest edition recorded on the server.",
  });

const clanManeuversPoint = z
  .object({
    t: z.number().meta({ description: "Capture instant, epoch seconds." }),
    place: z.number(),
    famePoints: z.number(),
  })
  .meta({
    id: "ClanManeuversPoint",
    description: "One recorded move of the clan through the edition.",
  });

// No `.meta({ id })` here: the generator names a component after the exported
// const, and declaring the same id again drops the whole `.meta`.
export const ClanManeuversResponse = z
  .object({
    clanId: z.number(),
    tag: z.string().nullable(),
    latest: clanManeuversLatest.nullable().meta({
      description:
        "The newest edition on the server, whether or not the clan is on it. Null when none was ever recorded.",
    }),
    current: clanManeuversCurrent.nullable().meta({
      description: "Null when the clan holds no place on the newest edition.",
    }),
    history: z.array(clanManeuversPoint).meta({
      description:
        "The clan's climb through the newest edition, oldest first: one point per capture that moved it.",
    }),
    editions: z.array(clanManeuversEdition).meta({
      description: "Every edition the clan held a place on, newest first.",
    }),
    members: z.array(maneuversPlayerEntry).meta({
      description:
        "The clan's players on the newest edition's player board, best place first, as the board shows them.",
    }),
    playersRanked: z.number().nullable().meta({
      description: "How many players hold a place on the newest edition's player board.",
    }),
    vehiclePositions: z.number().nullable().meta({
      description: "How many places on that player board win the vehicle.",
    }),
    accountBondsPercent: z.number().nullable().meta({
      description: "Share of the personal board, in percent, whose places earn bonds.",
    }),
    clanBondsPercent: z.number().nullable().meta({
      description:
        "Share of the clan board, in percent, whose members get a bond multiplier above one.",
    }),
  })
  .meta({
    description:
      "A clan's Maneuvers record, from our own capture of the event's boards.",
  });
