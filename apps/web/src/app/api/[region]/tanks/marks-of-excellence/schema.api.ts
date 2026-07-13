// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankIdentity } from "../identity.api";

const tankMoe = z
  .object({
    mark1: z.number().nullable(),
    mark2: z.number().nullable(),
    mark3: z.number().nullable(),
  })
  .meta({
    id: "TankMarksOfExcellence",
    description:
      "The combined-damage thresholds for the 1st, 2nd and 3rd Marks of Excellence on a tank, mirrored per region.",
  });

/** Response of `GET /{region}/tanks/marks-of-excellence`. */
export const TankMoeResponse = z.object({
  results: z.array(
    z.object({ identity: tankIdentity, moe: tankMoe.nullable() }),
  ),
});
