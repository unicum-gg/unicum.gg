// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod plus the shared param schemas), like every other one here.
import { z } from "zod";
import { ServerStatsRange } from "@unicum.gg/shared";
import { type EnumMeta, regionPath } from "@/services/openapi/schemas";

const totalPoint = z
  .object({
    at: z.coerce.date(),
    total: z.number(),
  })
  .meta({
    id: "RegionPopulationPoint",
    description: "A region's whole population at one instant.",
  });

const regionSeries = z
  .object({
    region: regionPath,
    current: z.number().nullable(),
    peak: z
      .object({ players: z.number(), at: z.coerce.date() })
      .nullable()
      .meta({ description: "Highest total inside the range." }),
    points: z.array(totalPoint),
  })
  .meta({
    id: "RegionPopulationSeries",
    description: "One region's totals over the range.",
  });

/** Response of `GET /servers/compare`: the three regions' populations on one
 * timeline. Region-less by nature, since comparing them is the point. */
export const ServerComparisonResponse = z
  .object({
    range: z.enum(ServerStatsRange).meta({
      description: "The range this payload covers.",
      "x-enum-source": "SERVER_STATS_RANGE",
    } as EnumMeta),
    regions: z.array(regionSeries),
  })
  .meta({
    id: "ServerComparison",
    description: "Population of every region, on one timeline.",
  });
