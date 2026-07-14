// Co-located response schema for this route. The `.api.ts` suffix is required:
// next-openapi-gen only scans `route.ts` plus `.ts` files whose name contains
// "api", so a plain `schema.ts` would be found by name but built empty. Keeping
// it a separate, server-free module (only zod + shared schemas) means client
// components can import it too (see the clan/player detail routes).
import { z } from "zod";

// Defined literally (not `.extend`ing the shared `playerSummary`): the
// generator cannot expand composition over an imported schema, and the search
// hit's contract differs anyway — `clan` is always present (nullable), where
// the leaderboard rows never carry it.
export const playerSearchHit = z
  .object({
    account_id: z.number(),
    nickname: z.string(),
    clan: z
      .object({ tag: z.string(), color: z.string() })
      .nullable()
      .meta({ description: "The player's clan tag and color, when tracked." }),
  })
  .meta({
    id: "PlayerSearchHit",
    description: "A player search hit: account id, nickname and clan (if any).",
  });

/** Response of `GET /{region}/players/search` (the combined, non-streamed set). */
export const PlayerSearchResponse = z.object({
  results: z.array(playerSearchHit),
});
