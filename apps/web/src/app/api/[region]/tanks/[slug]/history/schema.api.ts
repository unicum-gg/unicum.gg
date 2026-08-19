// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankHistoryVersion } from "../../changes.api";

/** Response of `GET /{region}/tanks/{slug}/history`: a tank's characteristic
 * changes across game versions, newest first. */
export const TankHistoryResponse = z.object({
  tankId: z.number(),
  slug: z.string(),
  versions: z.array(tankHistoryVersion),
  devVersion: z.string().nullable().meta({
    description:
      "The game version the tank first appeared as a dev stub (placeholder stats, before balancing), or null when it predates our version tracking.",
  }),
  devAt: z.coerce.date().nullable(),
  releasedVersion: z.string().nullable().meta({
    description:
      "The game version the tank was released in (its first real spec), or null when it predates our version tracking.",
  }),
  releasedAt: z.coerce.date().nullable(),
});
