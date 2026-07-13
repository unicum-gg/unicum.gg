// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankIdentity } from "../identity.api";

const tankMastery = z
  .object({
    class3: z.number().nullable(),
    class2: z.number().nullable(),
    class1: z.number().nullable(),
    ace: z.number().nullable(),
  })
  .meta({
    id: "TankMarksOfMastery",
    description:
      "The XP thresholds for the 3rd/2nd/1st Class and Ace Tanker Mark of Mastery badges on a tank, mirrored per region.",
  });

/** Response of `GET /{region}/tanks/marks-of-mastery`. */
export const TankMasteryResponse = z.object({
  results: z.array(
    z.object({ identity: tankIdentity, mastery: tankMastery.nullable() }),
  ),
});
