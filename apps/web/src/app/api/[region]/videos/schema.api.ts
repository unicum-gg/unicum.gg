// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the index page parses with it.
import { z } from "zod";
import { videoBattleWithTank } from "@/services/openapi/schemas";

/** Query of `GET /{region}/videos`. */
export const CommunityVideosQuery = z.object({
  /** A YouTube id, which narrows the answer to that recording's own battles,
   * in the order they happen rather than newest first. It is what a seek bar
   * reads: the page a video was opened from only knows its own slice of it,
   * and a competitive evening runs through a map rotation. */
  videoId: z.string().optional().meta({
    description: "Narrow to one video's battles, ordered by timestamp.",
  }),
});

/** Response of `GET /{region}/videos`. The index crosses tanks and formats, so
 * a row carries the vehicle it was played in when it was about one. */
export const CommunityVideosResponse = z.object({
  videos: z.array(videoBattleWithTank),
});
