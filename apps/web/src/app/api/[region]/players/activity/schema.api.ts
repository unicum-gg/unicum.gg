// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod plus the shared param schemas): the servers page parses the
// response with it to revive the one Date.
import { z } from "zod";
import { ActivityWindow, RatingColor } from "@unicum.gg/shared";
import { type EnumMeta, regionPath } from "@/services/openapi/schemas";

const counts = {
  players: z.number().meta({
    description: "Accounts in the band, whatever is known about them.",
  }),
  observed: z.number().meta({
    description:
      "Accounts read inside the window, and the denominator any activity rate should use. An account nobody read inside the window is not known to be idle, so scoring against every account in the band would measure our refresh cadence rather than the players.",
  }),
  active: z.number().meta({
    description: "Observed accounts whose last battle falls inside the window.",
  }),
  measured: z.number().meta({
    description:
      "Active accounts whose battle count for the window is known, which is 96 to 99 of every hundred. The window's battles are a diff between two stored snapshots, so an account can be known to have played while no pair exists to measure it with.",
  }),
  battles: z.number().meta({
    description: "Battles the measured accounts played inside the window.",
  }),
};

const point = z
  .object({
    day: z.string().meta({
      description:
        "The UTC day the counters were read on, `YYYY-MM-DD`. Not a day the battles fell in: every window looks backwards from the read.",
    }),
    ...counts,
  })
  .meta({
    id: "ActivityPoint",
    description: "One day of one band's series.",
  });

const band = z
  .object({
    band: z.enum(RatingColor).meta({
      description: "The rating band, as the site colours it.",
      "x-enum-source": "RATING_COLOR",
    } as EnumMeta),
    from: z.number().nullable().meta({
      description:
        "The band's lower edge as it stood when the rows were written, null at the scale's open end. Carried rather than recomputed, so a threshold that moves later cannot relabel rows it never measured.",
    }),
    to: z.number().nullable().meta({
      description: "The band's upper edge, excluded. Null at the open end.",
    }),
    latest: point.nullable().meta({
      description:
        "The most recent day held, which is the day in progress and still refining until midnight UTC.",
    }),
    series: z.array(point).meta({
      description:
        "Ascending by day, oldest first, at most one year. The series starts when recording started and cannot be backfilled: both counters are measured relative to the instant they were read, so a day nobody recorded is a day no later run can fill.",
    }),
  })
  .meta({
    id: "ActivityBand",
    description: "One band, its latest reading and its history.",
  });

/** Response of `GET /{region}/players/activity`: whether each band of the
 * region's players is still playing, and how much. */
export const PlayerActivityResponse = z
  .object({
    region: regionPath,
    window: z.enum(ActivityWindow).meta({
      description: "The window every count in the payload was measured over.",
      "x-enum-source": "ACTIVITY_WINDOW",
    } as EnumMeta),
    minBattles: z.number().meta({
      description:
        "Battles an account needs before it counts, the same floor the distribution histograms use so the two describe one population.",
    }),
    metrics: z
      .object({
        wn7: z.array(band),
        wn8: z.array(band),
        wnx: z.array(band),
        pr: z.array(band),
        wtr: z.array(band),
      })
      .meta({
        id: "ActivityMetrics",
        description:
          "One series per rating metric, ascending by band, so a reader's chosen metric is served rather than one being picked for them. A band nobody in the region falls into is absent rather than present and empty.",
      }),
    computedAt: z.coerce.date().nullable().meta({
      description: "When the newest row was written.",
    }),
  })
  .meta({
    id: "PlayerActivity",
    description:
      "Whether each band of a region's players is still playing, and how much.",
  });
