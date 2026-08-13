// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { clanSummary } from "@/services/openapi/schemas";
import { playerSearchHit } from "../../players/search/schema.api";

/**
 * Query of `GET /{region}/search/resolve`.
 *
 * Four comma-separated id lists, all optional: a caller that only pinned players
 * sends only `players`. Ids are strings on the wire because an arena id is one
 * (`10_hills`), and the numeric kinds are parsed server-side.
 */
export const searchResolveQuery = z.object({
  players: z
    .string()
    .optional()
    .meta({ description: "Account ids, comma separated." }),
  clans: z
    .string()
    .optional()
    .meta({ description: "Clan ids, comma separated." }),
  tanks: z
    .string()
    .optional()
    .meta({ description: "Vehicle ids, comma separated." }),
  maps: z
    .string()
    .optional()
    .meta({ description: "Arena ids, comma separated." }),
});

const tankResolved = z
  .object({
    tank_id: z.number(),
    slug: z.string(),
    name: z.string(),
    short_name: z.string(),
    tier: z.number(),
    nation: z.string(),
    type: z.string(),
  })
  .loose()
  .meta({
    id: "TankResolved",
    description: "Vehicle row (additional fields may be present).",
  });

const mapResolved = z
  .object({
    arena_id: z.string(),
    slug: z.string(),
    name: z.string(),
    camouflage: z.string(),
    minimap_url: z.string(),
  })
  .loose()
  .meta({
    id: "MapResolved",
    description: "Map row (additional fields may be present).",
  });

/**
 * Response of `GET /{region}/search/resolve`.
 *
 * Each list holds the entries that still resolve, in the same shapes the four
 * search endpoints return, and in no particular order: the caller knows the
 * order it asked in. An id that resolves to nothing is simply absent, which is
 * how a caller learns its stored copy is all it has left.
 */
export const SearchResolveResponse = z.object({
  players: z.array(playerSearchHit),
  clans: z.array(clanSummary),
  tanks: z.array(tankResolved),
  maps: z.array(mapResolved),
});
