// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it.
import { z } from "zod";

/** A participant's public identity, as the site's one naming format takes it. */
const battlePlayer = z
  .object({
    accountId: z.number(),
    nickname: z.string(),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable(),
    isVerified: z.boolean().meta({
      description: "The owner signed in here with this Wargaming account.",
    }),
    isSupporter: z.boolean().meta({
      description: "An active, non-anonymous support subscription.",
    }),
    twitchLogin: z.string().nullable().meta({
      description: "Their Twitch channel, when the account has linked one.",
    }),
    tournamentWins: z.number(),
    tournamentFeaturedWins: z.number(),
    tournamentBestTitle: z.string().nullable(),
    onslaughtBestTier: z.string().nullable(),
    onslaughtBestRank: z.number().nullable(),
    onslaughtSeasons: z.number(),
  })
  .meta({
    id: "BattlePlayer",
    description: "A participant's public identity.",
  });

/** One participant, named and rated. */
const battleParticipant = z
  .object({
    id: z.number().meta({
      description: "Battle-scoped vehicle id, unique within the battle.",
    }),
    account: z.number().optional().meta({
      description: "Wargaming account id, absent for a bot.",
    }),
    player: battlePlayer.nullable().meta({
      description:
        "How the site names this player: the nickname, the clan they wear and the crests they have earned. Null for a bot, or for an account nobody has ever looked up here.",
    }),
    team: z.number(),
    tank: z
      .object({
        id: z.number(),
        name: z.string(),
        shortName: z.string(),
        tier: z.number(),
        type: z.string(),
        nation: z.string(),
        tag: z.string(),
        slug: z.string().nullable(),
      })
      .nullable()
      .meta({ id: "BattleParticipantTank" }),
    own: z.record(z.string(), z.number()).meta({
      description:
        "Their whole line, exactly as the client's results reported it: damage, radio, track, stun, blocked, received, shots, hits, piercings, spotted, kills, lifeTime, deathReason, capturePoints, xp, credits, health, maxHealth.",
    }),
    medals: z.array(z.number()).optional().meta({
      description:
        "The medals this battle awarded them, by the game's own ids. Absent when there are none, which is the usual case.",
    }),
    rating: z.record(z.string(), z.number().nullable()).meta({
      description:
        "What this battle scored them, keyed by metric (`wn7`, `wn8`, `wnx`), against their own vehicle's expected values.",
    }),
  })
  .meta({
    id: "BattleParticipant",
    description: "One vehicle in a battle, named and rated.",
  });

/** Response of `GET /{region}/battles/{id}`. */
export const BattleDetailResponse = z
  .object({
    id: z.string(),
    startedAt: z.string().meta({ format: "date-time" }),
    map: z.string(),
    gameplay: z.string().nullable(),
    battleType: z.number(),
    duration: z.number().nullable(),
    winnerTeam: z.number().nullable(),
    finishReason: z.number().nullable(),
    clientVersion: z.string().nullable(),
    server: z.string().nullable().meta({
      description: "The cluster it ran on, when the results carried one.",
    }),
    reporters: z.number().meta({
      description: "How many clients reported this battle.",
    }),
    hasReplay: z.boolean().meta({
      description:
        "Whether the archive holds this battle's replay file, and so whether the 2D viewer has anything to draw. False for most battles: a replay only exists when a player who was there had recording on.",
    }),
    participants: z.array(battleParticipant).meta({
      description: "Every vehicle, both teams, by team then by damage.",
    }),
  })
  .meta({
    id: "BattleDetailResponse",
    description: "A whole battle, as the clients that played it reported it.",
  });
