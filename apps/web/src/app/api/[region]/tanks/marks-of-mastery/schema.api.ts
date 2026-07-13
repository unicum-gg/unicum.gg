// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankMasteryRow } from "../categories.api";

/** Response of `GET /{region}/tanks/marks-of-mastery`. */
export const TankMasteryResponse = z.object({
  results: z.array(tankMasteryRow),
});
