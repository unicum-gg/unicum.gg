// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  tournamentGameModeField,
  tournamentStatusField,
} from "@/services/openapi/schemas";

export const tournamentListItem = z
  .object({
    id: z.number(),
    title: z.string(),
    status: tournamentStatusField,
    gameModes: z.array(tournamentGameModeField),
    tierFrom: z.number().nullable().meta({
      description: "Lowest vehicle tier allowed, null when the format sets no floor.",
    }),
    tierTo: z.number().nullable(),
    minPlayersInTeam: z.number(),
    maxPlayersInTeam: z.number(),
    confirmedTeams: z.number().meta({
      description: "Teams with a complete roster, so the ones actually drawn.",
    }),
    startAt: z.date(),
    endAt: z.date(),
    registrationTill: z.date().nullable().meta({
      description: "When registration closes. Null once it has.",
    }),
    prize: z.string().nullable().meta({
      description: 'The reward as the organiser wrote it ("Gold + Bonds + Cash!").',
    }),
    logoUrl: z.string().nullable(),
    isFeatured: z.boolean(),
  })
  .meta({
    id: "TournamentListItem",
    description: "A tournament as the catalogue lists it.",
  });

/** Response of `GET /{region}/tournaments`. */
export const TournamentsListResponse = z.object({
  results: z.array(tournamentListItem),
  totalCount: z.number().meta({
    description: "Tournaments matching the filter, across every page.",
  }),
});
