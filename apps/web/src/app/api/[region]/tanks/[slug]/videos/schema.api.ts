// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the videos tab parses with it.
import { z } from "zod";
import {
  mapModeField,
  battleResultField,
  spawnDirectionField,
} from "@/services/openapi/schemas";

const tankVideo = z
  .object({
    id: z.number().int(),
    /** YouTube id, never a URL: the client builds the embed from it. */
    videoId: z.string(),
    startSeconds: z.number().int().meta({
      description: "Where the battle starts in the video, in seconds.",
    }),
    title: z.string(),
    channelName: z.string(),
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
    id: "TankVideo",
    description:
      "A community-suggested battle, as a deep link into a video at the minute this tank is played.",
  });

/** Response of `GET /{region}/tanks/{slug}/videos`. */
export const TankVideosResponse = z.object({
  videos: z.array(tankVideo),
});
