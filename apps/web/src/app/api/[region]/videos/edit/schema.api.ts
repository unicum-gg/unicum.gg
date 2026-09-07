// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { VideoSuggestBody } from "../suggest/schema.api";

/**
 * Body of `POST /{region}/videos/edit`: the same battle a suggestion is made
 * of, plus which row it replaces and, for a moderator, what lets them replace
 * someone else's.
 *
 * Built on the submission's own body rather than beside it, because the two
 * have to stay identical: an edit that validated less than a submission would
 * be a way around the rules by sending a battle and then correcting it into
 * something the form would have refused.
 *
 * The one field the submission has no room for is the vehicle: on the way in it
 * is implied by the page the dialog was opened from, which is exactly how a
 * battle ends up filed under the wrong tank, so here `tankSlug` is what the
 * correction is usually about.
 */
export const VideoEditBody = VideoSuggestBody.extend({
  id: z.number().int().meta({
    description: "The suggestion being corrected.",
  }),
  /** A moderator's ticket, minted by the Edit button in the moderation channel
   * and good for one submission for half an hour. Absent for an author
   * correcting their own, who is identified by their session. */
  token: z.string().optional().meta({
    description: "Signed moderator link, from the moderation channel.",
  }),
});

/**
 * Response of `POST /{region}/videos/edit`.
 *
 * `requeued` is the one thing the status code cannot say: an edit always ends
 * up back in the queue, and when the video was live until a second ago the
 * author has to be told it came down, rather than discovering it later on the
 * page it used to be on.
 */
export const VideoEditResponse = z.object({
  ok: z.boolean(),
  requeued: z.boolean().meta({
    description: "The correction took a published video back off the site.",
  }),
});
