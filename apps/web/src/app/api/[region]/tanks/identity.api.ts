// Shared vehicle identity for every /tanks dataset row, nested under `identity`.
// `.api.ts` so next-openapi-gen scans it; mirrors the core `VehicleMeta` (plus
// tankId/slug) so the datasets stay complete as the domain type grows.
import { z } from "zod";

export const tankIdentity = z
  .object({
    tankId: z.number(),
    slug: z.string(),
    tier: z.number(),
    type: z.string(),
    nation: z.string(),
    name: z.string(),
    shortName: z.string(),
    tag: z.string(),
    isPremium: z.boolean(),
    isReward: z.boolean(),
    isCommonTest: z
      .boolean()
      .meta({ description: "Only on the Common Test client, not yet released." }),
    // Optional: the dataset endpoints carry it, the changes feed (which is
    // about what already shipped) has no use for it.
    testChanges: z.number().optional().meta({
      description:
        "How many characteristics the current Common Test build changes on this vehicle; 0 when none.",
    }),
    role: z.string().nullable(),
    contourIcon: z.string().nullable(),
    bigIcon: z.string().nullable(),
  })
  .meta({
    id: "TankIdentity",
    description:
      "A vehicle's identity: tier, class, nation, names, tag, premium/reward flags, role and icon URLs.",
  });

export type TankIdentityRow = z.infer<typeof tankIdentity>;
