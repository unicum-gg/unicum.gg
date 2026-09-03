// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  tournamentGameModeField,
  tournamentStatusField,
  tournamentTeamStatusField,
} from "@/services/openapi/schemas";

export const clanTournamentEntry = z
  .object({
    tournamentId: z.number(),
    title: z.string(),
    status: tournamentStatusField,
    gameModes: z.array(tournamentGameModeField),
    tierFrom: z.number().nullable(),
    tierTo: z.number().nullable(),
    minPlayersInTeam: z.number().meta({
      description: "Roster bounds, which is how the format reads (7v7, 1v1).",
    }),
    maxPlayersInTeam: z.number(),
    startAt: z.date(),
    prize: z.string().nullable(),
    logoUrl: z.string().nullable().meta({
      description:
        "The organiser's logo. Not always a URL: some regions store a bare filename or a placeholder, so a caller should check the scheme before rendering it.",
    }),
    isFeatured: z.boolean().meta({
      description:
        "Wargaming's own editorial flag, which separates the branded championships from the automated dailies.",
    }),
    teamId: z.number(),
    teamTitle: z.string().meta({
      description:
        "The name the team entered under, which is whatever its captain typed and often not the clan tag.",
    }),
    teamStatus: tournamentTeamStatusField,
    clanMembers: z.number().nullable().meta({
      description:
        "How many of the roster were in this clan on the day. A team is attributed at a quarter of the format's team size, so a low count against a large format is a thin attribution.",
    }),
    bestPosition: z.number().nullable().meta({
      description:
        "Best placement the team reached across the tournament's stages. Null when nothing placed it: a team that never got past registration, and every team in a double-elimination bracket, which records no placement at all.",
    }),
  })
  .meta({
    id: "ClanTournamentEntry",
    description: "One tournament a clan entered, and how its team finished.",
  });

export const clanTournamentPlayer = z
  .object({
    accountId: z.number(),
    nickname: z.string(),
    entered: z.number().meta({
      description: "Tournaments this member was on a roster for.",
    }),
    wins: z.number(),
    featuredWins: z.number(),
    lastAt: z.date(),
    isVerified: z.boolean().optional(),
    isSupporter: z.boolean().optional(),
    twitchLogin: z.string().nullable().optional(),
    tournamentBestTitle: z.string().nullable().optional(),
  })
  .meta({
    id: "ClanTournamentPlayer",
    description:
      "A member of the clan and their tournament record. Both counters are given rather than a single score: the ratio between them is the signal, and a member with 6 wins from 87 entries wins far more often than one with 13 from 1,359.",
  });

/** Response of `GET /{region}/clans/{tag}/tournaments`. */
export const ClanTournamentsResponse = z.object({
  clanId: z.number(),
  tag: z.string(),
  entries: z.array(clanTournamentEntry),
  players: z.array(clanTournamentPlayer).meta({
    description:
      "The clan's own members who compete, most decorated first. The record is each player's whole record, not only what they won wearing this tag.",
  }),
  wins: z.number().meta({
    description: "Entries whose team finished first in one of the brackets.",
  }),
});
