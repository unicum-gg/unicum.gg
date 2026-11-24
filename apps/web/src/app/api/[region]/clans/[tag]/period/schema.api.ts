// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod), so the clan tables can import it too.
import { z } from "zod";
import { clanStrongholdStats } from "../stronghold/schema.api";
import { clanGlobalMapStats } from "../clan-wars/schema.api";

/** Response of `GET /{region}/clans/{tag}/period`. */
export const ClanStatWindowResponse = z
  .object({
    days: z.number().int(),
    stronghold: clanStrongholdStats.nullable().meta({
      description:
        "The change in the clan's Stronghold figures over the window, null when it has no Stronghold data or no snapshot to diff from.",
    }),
    globalMap: clanGlobalMapStats.nullable().meta({
      description:
        "The change in the clan's Global Map figures over the window, null when there is no snapshot to diff from.",
    }),
    from: z.coerce.date().nullable().meta({
      description: "The snapshot the window was diffed from.",
    }),
    truncated: z.boolean().meta({
      description:
        "We hold no snapshot of the clan that old, so the column covers everything since `from` rather than the whole window.",
    }),
  })
  .meta({
    id: "ClanStatWindow",
    description: "One period column of the clan's Stronghold and Clan Wars tables, over a window the caller chose.",
  });
