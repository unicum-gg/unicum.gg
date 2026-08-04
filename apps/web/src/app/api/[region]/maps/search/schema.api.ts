// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

const mapSearchRow = z
  .object({
    arena_id: z.string(),
    slug: z.string(),
    name: z.string(),
    camouflage: z.string(),
    minimap_url: z.string(),
  })
  .loose()
  .meta({
    id: "MapSearchRow",
    description: "Map row (additional fields may be present).",
  });

/** Response of `GET /{region}/maps/search` (the non-streamed map set). */
export const MapSearchResponse = z.object({ results: z.array(mapSearchRow) });
