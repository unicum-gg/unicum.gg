// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod plus the shared param schemas): the servers page parses the
// response with it to revive Dates.
//
// `z.coerce.date()` on the timestamps does double duty, as everywhere else in
// this API: it documents them as date-time and lets the client reuse the schema
// to turn the ISO strings back into `Date`s with no hand-written revival list.
import { z } from "zod";
import { ServerStatsRange } from "@unicum.gg/shared";
import { type EnumMeta, regionPath } from "@/services/openapi/schemas";

const serverRecord = z
  .object({
    players: z.number(),
    at: z.coerce.date(),
  })
  .meta({
    id: "ServerRecord",
    description: "A population figure and the instant it was recorded.",
  });

const populationPoint = z
  .object({
    at: z.coerce.date(),
    total: z.number().meta({
      description: "Sum of `values`, the whole region at that instant.",
    }),
    values: z.array(z.number()).meta({
      description:
        "One population per cluster, in the same order as the payload's `servers`. A cluster that was down holds its slot at zero rather than shifting the rest.",
    }),
  })
  .meta({
    id: "ServerPopulationPoint",
    description: "One point of the population series.",
  });

const clusterStat = z
  .object({
    server: z.string().meta({
      description:
        "Wargaming's own cluster name (e.g. EU1, 203), which is what the game's server selector shows. Never a rank.",
    }),
    current: z.number().nullable().meta({
      description:
        "Its population at the last recorded instant, null when it was absent from that sample (a cluster taken down stops being reported rather than being reported at zero).",
    }),
    peak: z.number(),
    peakAt: z.coerce.date().nullable(),
    average: z.number(),
    share: z.number().meta({
      description: "Its share of the region's latest total, 0..1.",
    }),
  })
  .meta({
    id: "ServerClusterStat",
    description: "What one cluster did over the range.",
  });

const rhythmCell = z
  .object({
    weekday: z
      .number()
      .meta({ description: "ISO weekday in UTC, 1 Monday .. 7 Sunday." }),
    hour: z.number().meta({ description: "Hour of that day in UTC, 0..23." }),
    average: z.number(),
    samples: z.number().meta({
      description:
        "How many instants fed the average. Zero for an hour never sampled.",
    }),
  })
  .meta({
    id: "ServerRhythmCell",
    description:
      "Average population of one weekday's hour over the trailing four weeks, in UTC. Shift it into the reader's timezone to read it as a rhythm.",
  });

/** Response of `GET /{region}/server/stats`: the region's recorded cluster
 * population over the requested range, plus its records and weekly rhythm. */
export const ServerStatsResponse = z
  .object({
    region: regionPath,
    range: z.enum(ServerStatsRange).meta({
      description: "The range this payload covers.",
      "x-enum-source": "SERVER_STATS_RANGE",
    } as EnumMeta),
    servers: z.array(z.string()).meta({
      description:
        "The clusters the region reported over the range, busiest first. Index into this for a point's `values`.",
    }),
    points: z.array(populationPoint),
    clusters: z.array(clusterStat),
    current: z.number().nullable().meta({
      description: "Latest recorded region total, null before the first sample.",
    }),
    average: z.number(),
    peak: serverRecord.nullable(),
    trough: serverRecord.nullable(),
    allTimePeak: serverRecord.nullable(),
    rhythm: z.array(rhythmCell),
    since: z.coerce.date().nullable().meta({
      description:
        "The oldest sample on record. Wargaming publishes population as an instant and keeps no history, so this series starts when the sampling started and nothing before it can be recovered.",
    }),
  })
  .meta({
    id: "ServerStats",
    description: "One region's recorded server population.",
  });

export type ServerStatsResponseData = z.infer<typeof ServerStatsResponse>;
