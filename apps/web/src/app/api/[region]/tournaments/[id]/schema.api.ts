// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  tournamentBracketTypeField,
  tournamentGameModeField,
  tournamentStatusField,
  tournamentTeamStatusField,
} from "@/services/openapi/schemas";

export const tournamentRosterPlayer = z
  .object({
    accountId: z.number(),
    nickname: z.string().meta({
      description:
        "The name the account carried when the roster was read, not its current one: players rename, and a bracket from 2019 reads as it was played.",
    }),
    role: z.string().meta({ description: '"owner" for the captain, empty otherwise.' }),
  })
  .meta({ id: "TournamentRosterPlayer", description: "One account on one team." });

export const teamClan = z
  .object({
    clanId: z.number(),
    clanTag: z.string().meta({
      description:
        "The clan's CURRENT tag, so the badge links somewhere that resolves. A clan we no longer track keeps the tag its roster carried at the time.",
    }),
    clanName: z.string().nullable(),
    clanColor: z.string().nullable(),
    clanEmblem: z.string().nullable(),
    members: z.number().meta({
      description:
        "How many of the roster were in that clan on the day, so a caller can judge how firm the attribution is. A team qualifies at a quarter of the format's team size.",
    }),
  })
  .meta({
    id: "TeamClan",
    description: "The clan behind a tournament team.",
  });

export const tournamentTeam = z
  .object({
    id: z.number(),
    title: z.string(),
    status: tournamentTeamStatusField,
    ownerAccountId: z.number().nullable(),
    playersCount: z.number(),
    players: z.array(tournamentRosterPlayer),
    ratedPlayers: z.number().meta({
      description:
        "How many of the roster we hold stats for, which is the denominator of the two averages below. A tournament roster can name accounts our coverage has never reached.",
    }),
    avgWn8: z.number().nullable().meta({
      description:
        "The roster's mean WN8 over its rated members, unweighted by battles so one veteran does not speak for the team. Null when none of them has been sampled.",
    }),
    avgWnx: z.number().nullable(),
    avgWinrate: z.number().nullable().meta({
      description:
        "The roster's mean win rate over its rated members, as a fraction (0.54, not 54).",
    }),
    rated30dPlayers: z.number().meta({
      description:
        "How many of the roster played in the last 30 days, the denominator of the two recent averages below. It differs from ratedPlayers: a rostered account that has not played the window has no recent form to report.",
    }),
    avgWn830d: z.number().nullable().meta({
      description:
        "The roster's mean WN8 over the trailing 30 days, counting only members who played in it. Null when none of them did.",
    }),
    avgWnx30d: z.number().nullable().meta({
      description:
        "The roster's mean WNX over the trailing 30 days, counting only members who played in it. Null when none of them did.",
    }),
    clan: teamClan.nullable().meta({
      description:
        "The clan this team fielded, resolved from clan membership AS OF THE DAY the tournament was played, not from where those players are now. Null for a mixed team, for a team split evenly between two clans, and for one whose accounts we do not track.",
    }),
  })
  .meta({
    id: "TournamentTeam",
    description:
      "One entry in a tournament. Teams are formed per tournament, not persistent: the same players enter next week's under a new name and a new id.",
  });

export const tournamentMatch = z
  .object({
    uuid: z.string(),
    stageId: z.number(),
    groupId: z.number(),
    state: z.string(),
    round: z.number().meta({
      description:
        "In a knockout, the distance from the end: round 1 IS the final, 2 the semi-finals, and -1 the third-place match. In a round robin, the plain matchday.",
    }),
    position: z.number(),
    team1Id: z.number().nullable().meta({
      description: "Null while the bracket has drawn the slot but not filled it.",
    }),
    team2Id: z.number().nullable(),
    winnerTeamId: z.number().nullable(),
    winsTeam1: z.number().nullable().meta({
      description: "Battles won. Null until the match is settled, which is not 0-0.",
    }),
    winsTeam2: z.number().nullable(),
    maps: z.string().nullable().meta({
      description: 'The maps played, as the organiser wrote them ("Cliff, Sand River").',
    }),
    startAt: z.date().nullable(),
    nextMatchForWinner: z.string().nullable().meta({
      description: "The uuid of the match the winner plays next, threading the tree.",
    }),
  })
  .meta({ id: "TournamentMatch", description: "One tie in a bracket." });

export const tournamentStanding = z
  .object({
    teamId: z.number(),
    position: z.number().nullable().meta({
      description:
        "Placement within this bracket, not the tournament, and not dense (teams out in the same round share a rank). Null across a double-elimination bracket, which records only the seeding.",
    }),
    seed: z.number().nullable(),
    wins: z.number().meta({
      description:
        "Only a round robin counts these. A knockout table carries the placement and leaves them at zero, which is absence, not a 0-0 record.",
    }),
    losses: z.number(),
    draws: z.number(),
    points: z.number().nullable(),
  })
  .meta({ id: "TournamentStanding", description: "A team's line in a bracket table." });

export const tournamentGroup = z
  .object({
    id: z.number(),
    order: z.number(),
    state: z.string(),
    teamsCount: z.number(),
    matches: z.array(tournamentMatch),
    standings: z.array(tournamentStanding),
  })
  .meta({
    id: "TournamentGroup",
    description:
      "One bracket inside a stage: a knockout holds its whole tree in a single group, a group stage has one per pool.",
  });

export const tournamentStage = z
  .object({
    id: z.number(),
    title: z.string(),
    bracketType: tournamentBracketTypeField,
    winnersPerGroup: z.number(),
    startAt: z.date().nullable(),
    groups: z.array(tournamentGroup),
  })
  .meta({
    id: "TournamentStage",
    description: "One phase of a tournament (a qualifier, a group stage, the playoffs).",
  });

export const tournamentPrizeTier = z
  .object({
    title: z.string(),
    order: z.number(),
    prizes: z.array(z.string()),
  })
  .meta({
    id: "TournamentPrizeTier",
    description:
      'One placement band and what it pays. Free text per line, so display material rather than amounts to sum: "500,000 Gold + 100,000 Bonds" is one string.',
  });

export const tournamentRulesSection = z
  .object({
    title: z.string(),
    description: z.string().meta({ description: "Raw HTML, as the organiser wrote it." }),
    order: z.number(),
  })
  .meta({ id: "TournamentRulesSection", description: "One block of the rules." });

const mapMarker = z.object({ left: z.number(), top: z.number() });
const teamMarkers = z.object({
  team1: z.array(mapMarker),
  team2: z.array(mapMarker),
});

export const tournamentMapRef = z
  .object({
    arenaId: z.string(),
    slug: z.string().nullable().meta({
      description:
        "The map's page slug, or null for an arena the map catalogue does not know (a retired or event-only space).",
    }),
    name: z.string().nullable(),
    minimapUrl: z.string().nullable(),
    spawns: teamMarkers.meta({
      description:
        "Where each side starts, as percentages from the minimap's top-left, for this tournament's battle type. The arena's team 1 and team 2 are the sides a match's team 1 and team 2 are assigned to.",
    }),
    bases: teamMarkers,
    controlPoint: mapMarker.nullable().meta({
      description: "The single point both sides fight over, on modes that have one.",
    }),
    pointsOfInterest: z
      .array(z.object({ type: z.number(), marker: mapMarker }))
      .meta({
        description:
          "Onslaught's posts, typed by the game's own POI constants. Empty on every random-battle mode.",
      }),
    widthMeters: z.number(),
    heightMeters: z.number().meta({
      description:
        "The play area, which a point's capture radius is drawn against.",
    }),
  })
  .meta({
    id: "TournamentMapRef",
    description: "One map in a tournament's pool, resolved against the catalogue.",
  });

/** Response of `GET /{region}/tournaments/{id}`. */
export const TournamentDetailResponse = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().meta({ description: "Raw HTML, as the organiser wrote it." }),
  status: tournamentStatusField,
  gameModes: z.array(tournamentGameModeField),
  tierFrom: z.number().nullable(),
  tierTo: z.number().nullable(),
  minPlayersInTeam: z.number(),
  maxPlayersInTeam: z.number(),
  confirmedTeams: z.number(),
  teamsLimit: z.number().nullable().meta({
    description:
      "The field's cap, when the format sets one. `confirmedTeams` says how many entered, never how many it takes.",
  }),
  schedule: z
    .array(z.object({ title: z.string(), startAt: z.string() }))
    .meta({
      description:
        'The sessions the tournament is played in. The title is the game SERVER ("EU 2"), which is what a captain needs on the night.',
    }),
  startAt: z.date(),
  endAt: z.date(),
  registrationFrom: z.date().nullable(),
  registrationTill: z.date().nullable(),
  prize: z.string().nullable(),
  prizeTiers: z.array(tournamentPrizeTier),
  rules: z.array(tournamentRulesSection),
  mapPool: z.array(tournamentMapRef),
  totalLevelFrom: z.number().nullable().meta({
    description: "Total tier points a team may field at once, when the format caps it.",
  }),
  totalLevelTo: z.number().nullable(),
  logoUrl: z.string().nullable(),
  teams: z.array(tournamentTeam),
  stages: z.array(tournamentStage),
});
