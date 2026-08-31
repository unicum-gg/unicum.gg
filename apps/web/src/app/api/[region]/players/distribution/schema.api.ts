// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod plus the shared param schemas): the servers page and the
// player page both parse the response with it.
import { z } from "zod";
import { VehicleType } from "@unicum.gg/wargaming";
import { type EnumMeta, regionPath } from "@/services/openapi/schemas";

const bucket = z
  .object({
    from: z.number(),
    to: z.number(),
    count: z.number(),
  })
  .meta({
    id: "DistributionBucket",
    description:
      "One column of a histogram, half-open: `from` included, `to` excluded. The first and last of a series collect everything outside the plotted range, so they are wider than the rest.",
  });

const battleShare = {
  tanks: z.number().meta({
    description: "Vehicles of this kind with tracked stats in the region.",
  }),
  battles: z.number(),
  winrate: z.number().meta({
    description: "Battle-weighted mean win rate, 0..1.",
  }),
};

const tierShare = z
  .object({ tier: z.number(), ...battleShare })
  .meta({
    id: "TierShare",
    description: "What one tier accounts for across the region.",
  });

const typeShare = z
  .object({
    type: z.enum(VehicleType).meta({
      description: "Vehicle class.",
      "x-enum-source": "VEHICLE_TYPE",
    } as EnumMeta),
    ...battleShare,
  })
  .meta({
    id: "TypeShare",
    description: "What one vehicle class accounts for across the region.",
  });

/** Response of `GET /{region}/players/distribution`: how the region's tracked
 * players are spread across win rate and WNX, and how its battles are spread
 * across tiers and vehicle classes. */
export const PlayerDistributionResponse = z
  .object({
    region: regionPath,
    minBattles: z.number().meta({
      description:
        "Battles an account needs before it counts towards the histograms.",
    }),
    players: z.number().meta({ description: "Accounts that met the threshold." }),
    winrate: z.array(bucket),
    ratings: z
      .object({
        wn7: z.array(bucket),
        wn8: z.array(bucket),
        wnx: z.array(bucket),
      })
      .meta({
        id: "RatingDistributions",
        description:
          "One histogram per rating metric, so a reader's chosen metric is served rather than one being picked for them.",
      }),
    byTier: z.array(tierShare),
    byType: z.array(typeShare),
    computedAt: z.coerce.date().nullable().meta({
      description:
        "When the aggregate was last recomputed. It is materialised hourly rather than read live, since the histograms are a full scan of the region's players.",
    }),
  })
  .meta({
    id: "PlayerDistribution",
    description: "How a region's players and battles are distributed.",
  });
