// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod): the clan page parses the response with it to revive Dates.
import { z } from "zod";

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

export const clanMember = z
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
    isVerified: z.boolean().optional(),
    isSupporter: z.boolean().optional(),
    twitchLogin: z.string().nullable().optional(),
  })
  .loose()
  .meta({
    id: "ClanMember",
    description: "A clan member with cached WN7/WN8/WNX ratings.",
  });

export const previousClan = z
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

export const clanEvent = z
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
    updatedAt: z.coerce.date().nullable(),
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

const ratingTriplet = z.object({
  wn7: z.number().nullable(),
  wn8: z.number().nullable(),
  wnx: z.number().nullable(),
});

const clanRatings = z
  .object({
    lifetime: ratingTriplet,
    recent: ratingTriplet,
    avgWinrate: z.number().nullable(),
  })
  .meta({
    id: "ClanRatings",
    description:
      "The clan's battle-weighted aggregate ratings: lifetime and 30-day WN7/WN8/WNX (weighted by lifetime and recent battles), plus the lifetime average win rate.",
  });

/**
 * Response of `GET /{region}/clans/{tag}`: the clan overview (profile + aggregate
 * ratings). The heavy per-category data (members, previous clans, activity,
 * stronghold, clan wars, vehicles) lives on the dedicated sub-endpoints.
 */
export const ClanOverviewResponse = z.object({
  clan: clanInfo,
  ratings: clanRatings,
  nameHistory: z
    .array(
      z.object({
        tag: z.string(),
        name: z.string(),
        recordedAt: z.coerce.date(),
      }),
    )
    .meta({
      description:
        "Previous tags + names of this clan, newest first. Empty until a rename is observed.",
    }),
});
