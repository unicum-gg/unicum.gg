// Co-located response schema (`.api.ts` so next-openapi-gen scans it). The route
// projects a `TankSpec` onto this schema via `.parse()`.
import { z } from "zod";
import { tankIdentity } from "../identity.api";

const n = () => z.number().nullable();

export const tankEconomics = z
  .object({
    buyCredits: n(),
    buyGold: n(),
    shellCost: n(),
    ammoCost: n(),
    researchXp: n(),
    totalFreeXp: n(),
  })
  .meta({
    id: "TankEconomics",
    description:
      "A tank's economics: purchase price (credits / gold), shell and ammo cost, research XP from its direct parent, and total free XP to reach it from a tier 1.",
  });

/** Response of `GET /{region}/tanks/economics`. */
export const TankEconomicsResponse = z.object({
  results: z.array(
    z.object({
      identity: tankIdentity,
      economics: tankEconomics.nullable(),
    }),
  ),
});
