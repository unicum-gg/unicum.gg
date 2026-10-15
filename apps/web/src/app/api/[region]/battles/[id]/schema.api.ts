// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it.
import { z } from "zod";
import { mapOverlay } from "@/app/api/[region]/players/[nickname]/battles/schema.api";

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
    loadouts: z
      .array(
        z
          .object({
            life: z.number().meta({
              description:
                "Counted from zero, in the order the lives were played. Always zero outside a mode with respawns.",
            }),
            optDevices: z.array(z.string().nullable()).meta({
              description:
                "The optional devices fitted, by slot. A free slot is a null in place, because a device's grade and category depend on which slot it sits in. An item no catalogue here knows keeps its number under an `unknown:` prefix rather than becoming a null, so a filled slot is never mistaken for an empty one.",
            }),
            boosters: z.array(z.string().nullable()).meta({
              description: "Directives fitted, by slot, a free one being null.",
            }),
            consumables: z.array(z.string().nullable()).meta({
              description: "Consumables carried, by slot, a free one being null.",
            }),
            shells: z
              .array(
                z.object({
                  name: z.string(),
                  type: z.string().meta({
                    description:
                      "ARMOR_PIERCING, ARMOR_PIERCING_CR, HOLLOW_CHARGE or HIGH_EXPLOSIVE, which is what picks the round's icon.",
                  }),
                  premium: z.boolean(),
                  count: z.number(),
                }),
              )
              .meta({ description: "The rounds loaded, in the client's own order." }),
            crew: z
              .array(
                z.object({
                  role: z.string().meta({
                    description: "commander, gunner, driver, radioman or loader.",
                  }),
                  skills: z.array(z.string()).meta({
                    description: "Skills trained, in the order they were learned.",
                  }),
                }),
              )
              .meta({
                description:
                  "One entry per seat, each with its own skills. Kept per seat rather than flattened: for the five skills every seat can learn, how many of the crew trained it is the whole effect.",
              }),
          })
          .meta({ id: "BattleParticipantLoadout" }),
      )
      .optional()
      .meta({
        description:
          "What this vehicle had fitted, one entry per life. Absent for almost every participant, and that is the designed state: a loadout exists only where a recording of the battle carried it, which means the player who recorded it and any team mate they followed after dying. Nothing is ever known this way about the other team.",
      }),
  })
  .meta({
    id: "BattleParticipant",
    description: "One vehicle in a battle, named and rated.",
  });

/** Response of `GET /{region}/battles/{id}`. */
export const BattleDetailResponse = z
  .object({
    mapImage: z.string().nullable().meta({
      description:
        "The minimap this battle was played on, resolved for its own mode: a mode that redraws the map into a smaller play area ships its own picture, and this is that one.",
    }),
    mapBounds: z
      .object({
        bottomLeft: z.object({ x: z.number(), z: z.number() }),
        upperRight: z.object({ x: z.number(), z: z.number() }),
      })
      .nullable()
      .meta({
        description:
          "The arena's extent in metres, which places a replay's coordinates on that image.",
      }),
    mapOverlay: mapOverlay.nullable().meta({
      description:
        "What this battle's mode puts on the minimap, already projected into `mapBounds`. Null when the arena declares nothing for it.",
    }),
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
    mark: z
      .object({
        percent: z.number(),
        previous: z.number().nullable(),
        account: z.number(),
      })
      .nullable()
      .meta({
        description:
          "Where one player's mark of excellence stood when this battle ended, and where it stood at the end of their previous battle in the same tank, with `account` naming whose gun it is. The figure comes from that client's own results and belongs to them alone, so a reader showing another participant must not show it. The game gives no 'before' of its own, so the movement is only knowable by looking at the battle before. Null when the reporting client is too old to send it, when the mode does not count towards marks, or when no earlier battle in that tank is held.",
      }),
    participants: z.array(battleParticipant).meta({
      description: "Every vehicle, both teams, by team then by damage.",
    }),
  })
  .meta({
    id: "BattleDetailResponse",
    description: "A whole battle, as the clients that played it reported it.",
  });
