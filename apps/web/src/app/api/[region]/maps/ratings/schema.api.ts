// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { mapCamouflageField } from "@/services/openapi/schemas";

/**
 * Who a rated map is, which the votes themselves do not say.
 *
 * The votes are keyed on the arena id and nothing else, so the board joins the
 * region's catalogue back on to get a slug to link to, a name to print and a
 * minimap to draw. Its own object rather than flattened into the row for the
 * same reason the vehicle board separates them: one half is a fact about the
 * catalogue and the other is a fact about the votes.
 */
export const mapRatingIdentity = z
  .object({
    arenaId: z.string(),
    slug: z.string(),
    name: z.string().meta({
      description:
        "The catalogue's English name, which is what the slug is derived from. A reader is shown Wargaming's own name in their language, resolved client-side from the arena id.",
    }),
    camouflage: mapCamouflageField,
    sizeMeters: z.number().int(),
    minimapUrl: z.string(),
    commonTest: z.boolean().meta({
      description:
        "Whether only the Common Test client ships this map's space, so the board can say the verdict is about something nobody can play on a live server yet.",
    }),
  })
  .meta({
    id: "MapRatingIdentity",
    description: "The catalogue's half of a rated map.",
  });

/** One map on the community board: who it is, and what the players think of it.
 * Maps nobody has rated are absent rather than present with nulls, so a caller
 * can tell "unrated" from "rated badly". */
export const mapRatingRow = z
  .object({
    identity: mapRatingIdentity,
    votes: z.number().int(),
    reviews: z.number().int().meta({
      description: "Published written opinions on this map.",
    }),
    overall: z.number().nullable().meta({
      description: "Plain mean of the Overall stars, 1 to 5.",
    }),
    fun: z.number().nullable(),
    overallBayes: z.number().nullable().meta({
      description:
        "The Overall mean shrunk towards the average of every map vote. Sort on this, not on the plain mean, or the top of the board is whichever map three people rated.",
    }),
    funBayes: z.number().nullable(),
    overallStddev: z.number().nullable().meta({
      description: "How far apart the voters sit. High marks a divisive map.",
    }),
  })
  .meta({
    id: "MapRatingRow",
    description: "A map's community verdict.",
  });

/** Response of `GET /{region}/maps/ratings`. */
export const MapRatingBoardResponse = z.object({
  results: z.array(mapRatingRow),
  totalVotes: z.number().int().meta({
    description: "Votes cast across every map, for the board's header.",
  }),
  ratedMaps: z.number().int(),
  computedAt: z.coerce.date().nullable().meta({
    description:
      "When the rollup behind the shrunk means was last recomputed. Null before it has ever run, which is also when every shrunk mean is null.",
  }),
});
