// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tournamentTeamStatusField } from "@/services/openapi/schemas";

export const tournamentRosterEntry = z
  .object({
    accountId: z.number(),
    nickname: z.string().meta({
      description:
        "The name the account carried when the roster was read. Kept verbatim so an old bracket reads as it was played.",
    }),
    role: z.string().meta({ description: '"owner" for the captain, empty otherwise.' }),
    currentNickname: z.string().nullable().meta({
      description:
        "What the account is called today, when we track it. Differs from `nickname` for anyone who renamed since.",
    }),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable(),
    isVerified: z.boolean().optional(),
    isSupporter: z.boolean().optional(),
    twitchLogin: z.string().nullable().optional(),
    tournamentWins: z.number().optional(),
    tournamentFeaturedWins: z.number().optional(),
    tournamentBestTitle: z.string().nullable().optional(),
    recordedClanTag: z.string().nullable().meta({
      description:
        "The clan they were in ON THE DAY, which is the tag the recorded nickname belongs beside. Wargaming freezes the nickname at the time of the tournament, so pairing it with today's clan would put a 2018 name next to a clan joined years later.",
    }),
    recordedClanColor: z.string().nullable(),
    battles: z.number().nullable().meta({
      description:
        "Lifetime battles. Null for an account we have never sampled, which is absence rather than a zero.",
    }),
    winrate: z.number().nullable().meta({ description: "Lifetime win rate, 0-1." }),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
  })
  .meta({
    id: "TournamentRosterEntry",
    description: "One roster line, joined onto the account behind it.",
  });

/** Response of `GET /{region}/tournaments/{id}/team/{teamId}`. */
export const TournamentTeamRosterResponse = z.object({
  id: z.number(),
  tournamentId: z.number(),
  title: z.string(),
  status: tournamentTeamStatusField,
  ownerAccountId: z.number().nullable(),
  players: z.array(tournamentRosterEntry),
});
