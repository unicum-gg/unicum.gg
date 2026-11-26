// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const botUsageDay = z.object({
  day: z.string().meta({ description: "UTC day, YYYY-MM-DD." }),
  count: z.number(),
});

/** Response of `GET /usage/bot`. */
export const BotUsageResponse = z
  .object({
    guilds: z.number().nullable().meta({
      description:
        "Discord servers the bot is in, at the latest reading. Null when it has never been read.",
    }),
    guildsDaily: z.array(botUsageDay).meta({
      description:
        "The server count on each of the last 30 UTC days, from the first day it was recorded. Discord only ever answers the present, so the history is what we sampled.",
    }),
    commandsDaily: z.array(botUsageDay).meta({
      description: "Slash commands answered on each of the last 30 UTC days, from the first day they were counted.",
    }),
    commandsMonth: z.number().meta({
      description: "Slash commands answered over the last 30 days.",
    }),
    commandsAllTime: z.number().meta({
      description: "Slash commands answered since they started being counted.",
    }),
    commands: z
      .array(
        z.object({
          command: z.string().meta({ description: "The command's name, without the slash.", example: "player" }),
          count: z.number(),
        }),
      )
      .meta({ description: "Each command's share of the last 30 days, most used first." }),
  })
  .meta({
    id: "BotUsage",
    description:
      "How much the unicum.gg Discord bot is used: the servers it is in and the commands it answers.",
  });
