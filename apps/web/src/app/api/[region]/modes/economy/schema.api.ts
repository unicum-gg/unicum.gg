// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod plus the shared param schemas), so the servers page can import
// it too.
import { z } from "zod";
import { LoadoutMode } from "@unicum.gg/shared";
import { type EnumMeta, regionPath } from "@/services/openapi/schemas";

const modeEconomyRow = z
  .object({
    mode: z.enum(LoadoutMode).meta({
      description: "The battle mode this row was counted in.",
      "x-enum-source": "LOADOUT_MODE",
    } as EnumMeta),
    tier: z.number().int(),
    battles: z.number().int(),
    records: z.number().int().meta({
      description:
        "Vehicle records: one account's part in one battle, every participant of each recorded battle, bots excluded.",
    }),
    players: z.number().int(),
    creditsPerBattle: z.number().meta({
      description:
        "Credits the battle itself paid, per record: before the premium account, reserves, missions and every cost, so nothing about a player's account leaks into it.",
    }),
    creditsPerMinute: z.number().meta({
      description: "The same credits per minute of battle (the battle's own length).",
    }),
    xpPerBattle: z.number(),
    xpPerMinute: z.number(),
    avgDuration: z.number().meta({ description: "Mean battle length, in seconds." }),
    winrate: z.number().meta({ description: "Share of records on the winning side, 0..1." }),
    netRecords: z.number().int().meta({
      description:
        "Battles behind the net figures: the uploader's own economy, which only the uploader's results carry.",
    }),
    netPlayers: z.number().int(),
    grossPerBattle: z.number().nullable().meta({
      description:
        "What an uploader earned per battle, premium and bonuses included, before repairs, ammunition and consumables. Null with no record.",
    }),
    costsPerBattle: z.number().nullable().meta({
      description: "Repairs, ammunition and consumables per battle. Null with no record.",
    }),
    netPerBattle: z.number().nullable().meta({
      description:
        "Gross minus costs: what landed in the account. A small sample of the mod's own players, carrying their habits (premium account, gold shells), so read it with netPlayers.",
    }),
  })
  .meta({ id: "ModeEconomyRow", description: "What one battle mode pays at one tier." });

/** Response of `GET /{region}/modes/economy`. */
export const ModeEconomyResponse = z
  .object({
    region: regionPath,
    windowDays: z.number().int().meta({
      description: "How far back the battles are counted.",
    }),
    rows: z.array(modeEconomyRow).meta({
      description:
        "One row per (mode, tier) holding enough records to read, highest tier first. Compare modes within a tier: a vehicle earns by its tier and the modes do not share one.",
    }),
    computedAt: z.coerce.date().nullable().meta({
      description: "When the rows were last rebuilt (hourly).",
    }),
  })
  .meta({
    id: "ModeEconomy",
    description: "What each battle mode pays, tier by tier, read from the recorded battles.",
  });
