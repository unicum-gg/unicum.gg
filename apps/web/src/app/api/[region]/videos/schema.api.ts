// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the index page parses with it.
import { z } from "zod";
import {
  mapModeField,
  battleResultField,
  spawnDirectionField,
} from "@/services/openapi/schemas";

/**
 * A battle on the community index.
 *
 * The same shape a tank page reads, plus the tank it was played in: the index
 * crosses tanks, and a video legitimately carries battles of several, so
 * without it a row has no way back to where it belongs.
 */
const communityVideo = z
  .object({
    id: z.number().int(),
    videoId: z.string(),
    startSeconds: z.number().int().meta({
      description: "Where the battle starts in the video, in seconds.",
    }),
    title: z.string(),
    channelName: z.string(),
    tankId: z.number().int(),
    tankName: z.string(),
    tankSlug: z.string(),
    tankShortName: z.string(),
    tankTag: z.string(),
    tier: z.number().int(),
    nation: z.string(),
    type: z.string(),
    role: z.string().nullable(),
    isPremium: z.boolean(),
    isReward: z.boolean(),
    mapName: z.string().nullable(),
    mode: mapModeField.nullable(),
    direction: spawnDirectionField.nullable().meta({
      description:
        "Side the player spawned from, derived from the map's own geometry rather than declared.",
    }),
    directionLabel: z.string().nullable(),
    result: battleResultField.nullable(),
    combinedDamage: z.number().int().nullable().meta({
      description: "Damage dealt plus assisted, as declared by the submitter.",
    }),
    gameVersion: z.string().nullable().meta({
      description: "Client version at the time the video was approved.",
    }),
  })
  .meta({
    id: "CommunityVideo",
    description:
      "A community-suggested battle, with the tank it was played in.",
  });

/** Response of `GET /{region}/videos`. */
export const CommunityVideosResponse = z.object({
  videos: z.array(communityVideo),
});
