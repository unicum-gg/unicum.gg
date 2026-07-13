// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

const tankSummary = z
  .object({
    tank_id: z.number(),
    name: z.string(),
    short_name: z.string(),
    tier: z.number(),
    nation: z.string(),
    type: z.string(),
  })
  .loose()
  .meta({
    id: "TankSummary",
    description: "Vehicle row (additional fields may be present).",
  });

/** Response of `GET /{region}/tanks/search` (the non-streamed vehicle set). */
export const TankSearchResponse = z.object({ results: z.array(tankSummary) });
