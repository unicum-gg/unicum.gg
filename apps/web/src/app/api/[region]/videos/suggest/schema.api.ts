// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  battleFormatField,
  battleResultField,
  mapModeField,
} from "@/services/openapi/schemas";

/**
 * Body of `POST /{region}/videos/suggest`. Sign-in required; the map and mode
 * are checked against the catalogue server-side, so a hand-made request cannot
 * file a battle under a map that never runs it.
 *
 * The map, not the tank, is what a submission is filed under. A random battle
 * is about the vehicle someone played, and a competitive tactic is about the
 * ground it was fought on and the side it was fought from, so the vehicle is
 * the part that is allowed to be missing.
 *
 * The rest of the battle context is required. One row is one battle, and a row
 * without its map or side is a link with no way to be found: it cannot be
 * filtered, and a moderator has nothing to check the video against. Since a
 * suggestion that does not match its video is turned down anyway, asking for
 * the fields up front is the same standard applied earlier.
 */
export const VideoSuggestBody = z.object({
  url: z.string().meta({ description: "YouTube link, timestamp included." }),
  /** Overrides whatever `?t=` the link carried. The form shows this as its own
   * field, because a link copied without "start at current time" carries no
   * timestamp at all and would otherwise file a three-hour VOD at second 0. */
  startSeconds: z.number().int().min(0).optional(),
  arenaId: z.string(),
  mode: mapModeField,
  spawnTeam: z.number().int().min(1).max(2),
  result: battleResultField,
  format: battleFormatField,
  /** The vehicle, by slug, when the battle is about one. Required in practice
   * for a random battle (the endpoint refuses one without it), and left out of
   * a tactic, where naming the camera's vehicle would file a team's plan under
   * one player's tank. */
  tankSlug: z.string().optional().meta({
    description: "Vehicle the battle was played in, for a random battle.",
  }),
  /** Damage dealt plus assisted, on a random battle: it is read off the same
   * after-battle screen a moderator checks the video against, and it is what
   * makes two of them comparable. Meaningless on a tactic, where nobody is
   * looking up one player's game, so it is refused there. The ceiling only
   * rules out a typo, not a record. */
  combinedDamage: z.number().int().min(0).max(50000).optional().meta({
    description: "Damage dealt plus assisted, on a random battle.",
  }),
  /** Players per team and the tier fought at, only where the format leaves them
   * open. Clan Wars and Advances are tier X fifteens and Onslaught a tier X
   * seven, so sending them there would be retyping a rule, and the endpoint
   * ignores them rather than trusting a contradiction. */
  teamSize: z.number().int().min(1).max(30).optional(),
  tier: z.number().int().min(1).max(11).optional(),
  /** The clan the battle was played for, by tag, resolved against the region in
   * the path. Optional: an independent caller has a tactic worth publishing too.
   * A tag we do not track is refused rather than dropped, so a typo cannot
   * quietly cost someone their credit. */
  clanTag: z.string().optional().meta({
    description: "Tag of the clan the battle was played for.",
  }),
});

/** Response of `POST /{region}/videos/suggest`.
 *
 * A plain acknowledgement, like `/feedback`: every other outcome is an HTTP
 * status (409 duplicate, 422 unreachable), so a field enumerating them would
 * only ever hold one value and would be a second place to keep in step with
 * `SubmitVideoOutcome`. */
export const VideoSuggestResponse = z.object({
  ok: z.boolean(),
});
