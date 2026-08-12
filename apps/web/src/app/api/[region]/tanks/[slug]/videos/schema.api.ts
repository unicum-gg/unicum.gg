// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the videos tab parses with it.
import { z } from "zod";
import { videoBattle } from "@/services/openapi/schemas";

const tankVideo = videoBattle.meta({
  id: "TankVideo",
  description:
    "A community-suggested battle, as a deep link into a video at the minute this tank is played.",
});

/** Response of `GET /{region}/tanks/{slug}/videos`. */
export const TankVideosResponse = z.object({
  videos: z.array(tankVideo),
});
