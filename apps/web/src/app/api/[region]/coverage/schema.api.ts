// Co-located response schema for this route. The `.api.ts` suffix is required:
// next-openapi-gen only scans `route.ts` plus `.ts` files whose name contains
// "api", so a plain `schema.ts` would be found by name but built empty. Client
// components import it too (the coverage view revives dates through the SDK).
import { z } from "zod";

const dailyPoint = z.object({
  day: z.string().meta({ description: "UTC day, YYYY-MM-DD." }),
  count: z.number(),
});

// One dated cost line. `to` is null while the line is still being billed, so a
// hosting move is recorded by closing the old line and opening the next one
// rather than by editing a number in place.
const expenseLine = z.object({
  label: z.string(),
  eurPerCharge: z.number().meta({
    description: "What a single charge costs. Subscriptions are prepaid, so the cumulative spend counts whole charges, never fractions of them.",
  }),
  chargesPerYear: z.number().meta({
    description: "Charges in a year: 12 monthly, 1 yearly.",
  }),
  eurAnnual: z.number(),
  eurMonthly: z.number(),
  from: z.string().meta({ description: "UTC day it started, YYYY-MM-DD." }),
  to: z
    .string()
    .nullable()
    .meta({ description: "UTC day it stopped, or null while still billed." }),
  note: z.string().optional(),
});

const refreshPolicyBucket = z.object({
  // Inline literals: the generator cannot read an imported enum. Locked to
  // `ActivityBucket` in `@unicum.gg/shared/players/refresh-policy`.
  bucket: z.enum([
    "unfetched",
    "hidden",
    "active_24h",
    "active_7d",
    "recent_30d",
    "recent_90d",
    "dormant_1y",
    "inactive",
  ]),
  cadenceMs: z.number().meta({
    description: "Target refresh cadence for this activity bucket, in ms.",
  }),
  total: z.number(),
  onTime: z.number(),
  neverSnapped: z.number(),
});

/** Response of `GET /{region}/coverage`: how much of the region the tracker
 * covers, refresh-policy health, 30-day trends and infrastructure facts. */
export const CoverageResponse = z
  .object({
    region: z.enum(["eu", "na", "asia"]),
    players: z.number(),
    clans: z.number(),
    playerSnapshots: z.number(),
    tankSnapshots: z.number(),
    clanMembers: z.number(),
    clanRecentEvents: z.number(),
    clanRefreshQueue: z.number(),
    playerRefreshQueue: z.number(),
    snapshotBacklog: z.number(),
    activity: z.object({
      lastPlayerSnapshotAt: z.coerce.date().nullable(),
      lastClanRefreshAt: z.coerce.date().nullable(),
      playerSnapshotsLast24h: z.number(),
      clansRefreshedLast24h: z.number(),
      snapshotFreshness: z.object({
        onTime: z.number(),
        fetched: z.number(),
      }),
      awaitingFirstSnapshot: z.number(),
    }),
    refreshPolicy: z.array(refreshPolicyBucket),
    funFacts: z.object({
      oldestPlayerSnapshotAt: z.coerce.date().nullable(),
      biggestClan: z
        .object({
          tag: z.string(),
          name: z.string(),
          membersCount: z.number(),
        })
        .nullable(),
      totalBattlesTracked: z.number(),
      discordServers: z.number().nullable().meta({
        description:
          "Discord servers our bot is in. Global, not per region. Null when Discord could not be reached.",
      }),
    }),
    trends: z.object({
      playersDiscoveredDaily: z.array(dailyPoint),
      clansDiscoveredDaily: z.array(dailyPoint),
      playerSnapshotsDaily: z.array(dailyPoint),
      firstSnapshotsDaily: z.array(dailyPoint),
    }),
    infrastructure: z.object({
      databaseBytes: z.number(),
      tables: z.array(z.object({ name: z.string(), bytes: z.number() })),
      // Every amount is in EUR, the currency all of these are invoiced in.
      // Nothing is stored converted: a client renders them in a regional
      // currency with the live rates from `GET /rates`.
      costs: z.object({
        recurring: z.array(expenseLine),
        past: z.array(expenseLine),
        oneOff: z.array(
          z.object({
            label: z.string(),
            eur: z.number(),
            incurredAt: z.string(),
            note: z.string().optional(),
          }),
        ),
        totalAnnualEur: z.number(),
        totalOneOffEur: z.number(),
      }),
    }),
  })
  .meta({
    id: "Coverage",
    description:
      "Tracker coverage for one region: row counts, refresh-policy health, 30-day discovery/snapshot trends and infrastructure size/cost.",
  });
