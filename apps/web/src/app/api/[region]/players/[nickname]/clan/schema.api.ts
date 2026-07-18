// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const playerClanTag = z
  .object({
    tag: z.string(),
    name: z.string(),
    color: z
      .string()
      .meta({ description: "Clan display color as a hex string." }),
  })
  .meta({
    id: "PlayerClanTag",
    description: "A player's current clan: tag, name and display color.",
  });

/** Response of `GET /{region}/players/{nickname}/clan`. */
export const PlayerClanResponse = z
  .object({
    clan: playerClanTag.nullable(),
  })
  .meta({
    id: "PlayerClan",
    description:
      "A player's current clan, from cached data only (no live Wargaming call). `clan` is null when the player is not in a clan or is not yet cached.",
  });
