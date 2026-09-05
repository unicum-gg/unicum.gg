// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod plus the shared param schemas), so the servers page parses the
// response with it.
import { z } from "zod";
import { RatingColor } from "@unicum.gg/shared";
import { type EnumMeta, regionPath } from "@/services/openapi/schemas";

const cell = z
  .object({
    tier: z.number(),
    band: z.enum(RatingColor).meta({
      description:
        "Rating band the players of this cell belong to, on the metric this grid is filed under. The band's numeric edges are the site's own rating colour thresholds.",
      "x-enum-source": "RATING_COLOR",
    } as EnumMeta),
    bandFrom: z.number().nullable().meta({
      description:
        "Lower edge of the band, included. Null at the bottom of the scale. These are the edges the row was banded with, not today's thresholds, so a threshold that moves later cannot relabel a row it never measured.",
    }),
    bandTo: z.number().nullable().meta({
      description:
        "Upper edge of the band, excluded. Null at the top of the scale.",
    }),
    players: z.number().meta({
      description: "Accounts of the band with a qualifying vehicle at the tier.",
    }),
    battles: z.number(),
    wins: z.number(),
    winrate: z.number().meta({
      description:
        "Battle-weighted win rate, 0..1: the band's wins at this tier over its battles there, not the mean of its players' own win rates.",
    }),
  })
  .meta({
    id: "TierWinrateCell",
    description: "What one rating band did at one tier.",
  });

/** Response of `GET /{region}/players/winrate-by-tier`: what each band of the
 * region's players wins at each tier. */
export const TierWinrateResponse = z
  .object({
    region: regionPath,
    minBattles: z.number().meta({
      description:
        "Battles a player needs on a vehicle before it counts towards their tiers, so the grid describes the tiers as played by the people who play them.",
    }),
    metrics: z
      .object({
        wn7: z.array(cell),
        wn8: z.array(cell),
        wnx: z.array(cell),
      })
      .meta({
        id: "TierWinrateMetrics",
        description:
          "One grid per rating metric, so a reader's chosen metric is served rather than one being picked for them.",
      }),
    computedAt: z.coerce.date().nullable().meta({
      description:
        "When the grid was last rebuilt. It is a by-product of the nightly pass over the per-vehicle snapshots, so it moves once a day.",
    }),
  })
  .meta({
    id: "TierWinrate",
    description:
      "What each band of a region's players wins at each tier of vehicle.",
  });
