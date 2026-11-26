// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const modUsageDay = z.object({
  day: z.string().meta({ description: "UTC day, YYYY-MM-DD." }),
  count: z.number(),
});

/** Response of `GET /usage/mod`. */
export const ModUsageResponse = z
  .object({
    users: z.number().meta({
      description:
        "Accounts that have ever run the mod: every account that sent a battle or a garage. Both uploads are proven by the game client's own token.",
    }),
    battles: z.number().meta({
      description: "Battles the mod has sent, each counted once however many players reported it.",
    }),
    activeWeek: z.number().meta({
      description: "Distinct accounts that sent a battle over the last 7 days.",
    }),
    activeMonth: z.number().meta({
      description: "Distinct accounts that sent a battle over the last 30 days.",
    }),
    battlesDaily: z.array(modUsageDay).meta({
      description: "Battles played on each of the last 30 UTC days, as the mod reported them.",
    }),
    uploadersDaily: z.array(modUsageDay).meta({
      description: "Distinct accounts that reported a battle played on each of the last 30 UTC days.",
    }),
    regions: z
      .array(
        z.object({
          region: z.enum(["eu", "na", "asia"]),
          users: z.number(),
          battles: z.number(),
          activeMonth: z.number(),
        }),
      )
      .meta({ description: "The same figures, server by server." }),
  })
  .meta({
    id: "ModUsage",
    description:
      "How many players run the unicum.gg mod and how much it sends, across the three servers.",
  });
