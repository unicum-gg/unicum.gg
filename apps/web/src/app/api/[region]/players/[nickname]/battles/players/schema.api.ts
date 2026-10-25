// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

export const playerBattleEncounter = z
  .object({
    accountId: z.number(),
    nickname: z.string(),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable(),
    tournamentWins: z.number(),
    tournamentFeaturedWins: z.number(),
    tournamentBestTitle: z.string().nullable(),
    isVerified: z.boolean().optional(),
    isSupporter: z.boolean().optional(),
    twitchLogin: z.string().nullable().optional(),
    onslaughtBestTier: z.string().nullable().optional(),
    onslaughtBestRank: z.number().nullable().optional(),
    onslaughtSeasons: z.number().optional(),
    battles: z.number().meta({
      description: "Battles the two were in, on the side the list is about.",
    }),
    wins: z.number().meta({
      description:
        "Of those, the ones this player's team won: the record together beside an ally, the record against them across from an opponent.",
    }),
    expected: z.number().meta({
      description:
        "The wins this player would have taken from those same battles at their own win rate in each battle's mode, over the same filter. wins minus expected is the difference the other player made, net of which modes the two play together.",
    }),
    lastAt: z.date().meta({
      description: "The most recent of those battles.",
    }),
  })
  .meta({
    id: "PlayerBattleEncounter",
    description: "Somebody this player keeps meeting in battle.",
  });

/** Response of `GET /{region}/players/{nickname}/battles/players`. */
export const PlayerBattleEncountersResponse = z.object({
  accountId: z.number(),
  nickname: z.string(),
  allies: z.array(playerBattleEncounter).meta({
    description:
      "Who this player has been on the same team as most often, at least twice, most battles first.",
  }),
  opponents: z.array(playerBattleEncounter).meta({
    description:
      "Who this player has faced most often, at least twice, most battles first.",
  }),
});
