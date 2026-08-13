// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { SessionGranularity } from "@unicum.gg/shared";

// The per-battle picture of a set of battles, shared by a session and by each
// vehicle inside it: the two carry the same fields, so a reader compares a row
// with the tanks that made it without converting anything.
const sessionStats = {
  battles: z.number().int(),
  winrate: z.number().meta({ description: "Ratio in 0..1, not a percentage." }),
  avgDamage: z.number(),
  avgFrags: z.number(),
  avgSpotted: z.number(),
  avgDefense: z.number(),
  avgAssist: z.number(),
  avgXp: z.number().nullable(),
  survivalRate: z.number().nullable(),
  kd: z
    .number()
    .nullable()
    .meta({ description: "Frags over deaths. Null when nothing died." }),
  damageRatio: z.number().nullable().meta({
    description:
      "Damage dealt over damage taken. Null on sessions whose snapshots predate that counter.",
  }),
  wn7: z.number().nullable(),
  wn8: z.number().nullable(),
  wnx: z.number().nullable(),
};

const sessionVehicle = z
  .object({
    tankId: z.number().int(),
    slug: z.string().nullable(),
    name: z.string(),
    shortName: z.string().nullable(),
    tier: z.number().int().nullable(),
    nation: z.string().nullable(),
    type: z.string().nullable(),
    isPremium: z.boolean(),
    isReward: z.boolean(),
    ...sessionStats,
  })
  .meta({
    id: "SessionVehicle",
    description: "One vehicle's share of a session.",
  });

const playerSession = z
  .object({
    period: z.string().meta({
      description: "ISO date of the bucket's first day.",
    }),
    tanks: z.number().int().meta({
      description: "Distinct vehicles taken into battle.",
    }),
    avgTier: z.number().nullable(),
    vehicles: z.array(sessionVehicle),
    ...sessionStats,
  })
  .meta({
    id: "PlayerSession",
    description:
      "One bucket of play: what an account did over that day, week or month.",
  });

/**
 * Response of `GET /{region}/players/{nickname}/sessions`.
 *
 * Newest bucket first. The game keeps no session log and Wargaming exposes
 * none, so each one is the difference between two consecutive snapshots of the
 * player's vehicles, bucketed by when it was observed.
 */
export const PlayerSessionsResponse = z
  .object({
    granularity: z.enum(SessionGranularity),
    sessions: z.array(playerSession),
  })
  .meta({
    id: "PlayerSessions",
    description: "One player's play sessions, newest first.",
  });
