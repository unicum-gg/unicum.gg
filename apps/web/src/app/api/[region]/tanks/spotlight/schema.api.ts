// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankIdentity } from "../identity.api";

const spotlightTank = z
  .object({
    identity: tankIdentity,
    releasedIn: z.string().nullable().meta({
      description:
        "The update that released the vehicle, or null for one only the Common Test client carries.",
    }),
  })
  .meta({
    id: "SpotlightTank",
    description: "A new or upcoming vehicle and the update it arrived in.",
  });

/** Response of `GET /{region}/tanks/spotlight`: the newest vehicles. */
export const TankSpotlightResponse = z.object({
  tanks: z.array(spotlightTank).meta({
    description:
      "Up to eight vehicles: the Common Test's first, then each update's releases, newest update first and best tier first within one.",
  }),
});
