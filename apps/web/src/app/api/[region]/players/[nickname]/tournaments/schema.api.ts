// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  tournamentGameModeField,
  tournamentStatusField,
  tournamentTeamStatusField,
} from "@/services/openapi/schemas";

export const playerTournamentEntry = z
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
      description: "The team this player entered under, as named for that tournament.",
    }),
    teamStatus: tournamentTeamStatusField,
    isCaptain: z.boolean().meta({
      description: "Whether this player registered the team.",
    }),
    bestPosition: z.number().nullable().meta({
      description:
        "Best placement the team reached across the tournament's stages. Null when nothing placed it: a team that never got past registration, and every team in a double-elimination bracket, which records no placement at all.",
    }),
  })
  .meta({
    id: "PlayerTournamentEntry",
    description: "One tournament a player entered, and how their team finished.",
  });

/** Response of `GET /{region}/players/{nickname}/tournaments`. */
export const PlayerTournamentsResponse = z.object({
  accountId: z.number(),
  nickname: z.string(),
  entries: z.array(playerTournamentEntry),
  wins: z.number().meta({
    description: "Entries whose team finished first in one of the tournament's brackets.",
  }),
});
