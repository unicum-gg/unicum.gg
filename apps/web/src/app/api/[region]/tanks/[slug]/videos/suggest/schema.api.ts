// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { mapModeField, battleResultField } from "@/services/openapi/schemas";

/**
 * Body of `POST /{region}/tanks/{slug}/videos/suggest`. Sign-in required; the
 * map and mode are checked against the catalogue server-side, so a hand-made
 * request cannot file a battle under a map that never runs it.
 *
 * The battle context is required, not optional. One row is one battle, and a
 * row without its map or side is a link with no way to be found: it cannot be
 * filtered, and a moderator has nothing to check the video against. Since a
 * suggestion that does not match its video is turned down anyway, asking for
 * the fields up front is the same standard applied earlier.
 */
export const TankVideoSuggestBody = z.object({
  url: z.string().meta({ description: "YouTube link, timestamp included." }),
  /** Overrides whatever `?t=` the link carried. The form shows this as its own
   * field, because a link copied without "start at current time" carries no
   * timestamp at all and would otherwise file a three-hour VOD at second 0.
   * Optional, and only this one: a short video devoted to the tank legitimately
   * opens on the battle. */
  startSeconds: z.number().int().min(0).optional(),
  arenaId: z.string(),
  mode: mapModeField,
  spawnTeam: z.number().int().min(1).max(2),
  result: battleResultField,
  /** Damage dealt plus assisted. Required like the rest of the battle context:
   * it is read off the same after-battle screen a moderator checks the video
   * against, and it is what makes one battle comparable to another. The ceiling
   * only rules out a typo, not a record. */
  combinedDamage: z.number().int().min(0).max(50000).meta({
    description: "Damage dealt plus assisted, as declared by the submitter.",
  }),
});

/** Response of `POST /{region}/tanks/{slug}/videos/suggest`.
 *
 * A plain acknowledgement, like `/feedback`: every other outcome is an HTTP
 * status (409 duplicate, 422 unreachable), so a field enumerating them would
 * only ever hold one value and would be a second place to keep in step with
 * `SubmitVideoOutcome`. */
export const TankVideoSuggestResponse = z.object({
  ok: z.boolean(),
});
