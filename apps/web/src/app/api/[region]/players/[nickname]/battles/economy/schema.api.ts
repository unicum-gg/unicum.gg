// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod), so the Battles tab can import it too.
import { z } from "zod";

const playerModeEconomyRow = z
  .object({
    battleType: z.number().int().meta({
      description:
        "The game's bonusType this row is named after. Every mode the player was paid in counts, events included; variants the game names alike (the Random Battle economies) are folded into one row.",
    }),
    tier: z.number().int().meta({
      description: "The vehicle's tier, or 0 for an event vehicle the vehicle catalogue does not hold.",
    }),
    battles: z.number().int(),
    winrate: z.number().meta({ description: "Share of those battles won, 0..1." }),
    avgDuration: z.number().meta({ description: "Mean battle length, in seconds." }),
    avgLifetime: z.number().meta({
      description: "Mean time the player stayed alive, in seconds (the battle's length when they survived).",
    }),
    grossPerBattle: z.number().meta({
      description:
        "Credits earned per battle, premium account and bonuses included, before repairs, ammunition and consumables.",
    }),
    repairPerBattle: z.number(),
    ammoPerBattle: z.number().meta({
      description: "The credits spent on ammunition per battle. Gold spent on shells is not in it.",
    }),
    suppliesPerBattle: z.number(),
    netPerBattle: z.number().meta({
      description: "Gross less repairs, ammunition and consumables: what landed in the account.",
    }),
    netPerMinute: z.number().meta({
      description: "The same per minute of battle (the battle's own length): the pace for a player who sees every battle out.",
    }),
    netPerMinuteAlive: z.number().meta({
      description: "The same per minute alive: the pace for a player who leaves for the next battle once destroyed.",
    }),
    premiumShare: z.number().meta({
      description: "Share of those battles played with a premium account, 0..1.",
    }),
  })
  .meta({
    id: "PlayerModeEconomyRow",
    description: "What one battle mode paid this player at one tier.",
  });

/** Response of `GET /{region}/players/{nickname}/battles/economy`. */
export const PlayerModeEconomyResponse = z
  .object({
    accountId: z.number().int(),
    nickname: z.string(),
    windowDays: z.number().int().meta({
      description: "How far back the battles are counted.",
    }),
    rows: z.array(playerModeEconomyRow).meta({
      description:
        "One row per (mode, tier) the player has uploaded battles in, highest tier first. Empty when they have uploaded none.",
    }),
    hidden: z.boolean().optional().meta({
      description:
        "The player keeps their battle list to themselves, and this with it. Anyone else then gets no rows; the player, signed in, gets their own as usual.",
    }),
  })
  .meta({
    id: "PlayerModeEconomy",
    description: "What each battle mode paid one player, tier by tier.",
  });
