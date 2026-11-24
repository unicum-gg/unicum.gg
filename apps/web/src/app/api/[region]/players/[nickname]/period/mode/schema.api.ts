// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod), so the mode tabs can import it too.
import { z } from "zod";
import { StatWindowMode, StatWindowUnit } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import { strongholdStats } from "../../schema.api";

/** Response of `GET /{region}/players/{nickname}/period/mode`. */
export const PlayerModeStatWindowResponse = z
  .object({
    accountId: z.number().int(),
    mode: z.enum(StatWindowMode).meta({
      description: "The mode the column reads.",
      "x-enum-source": "STAT_WINDOW_MODE",
    } as EnumMeta),
    window: z.object({
      unit: z.enum(StatWindowUnit).meta({
        description: "What the window counts: days from now, or the player's last battles in the mode.",
        "x-enum-source": "STAT_WINDOW_UNIT",
      } as EnumMeta),
      value: z.number().int(),
    }),
    stats: strongholdStats.nullable().meta({
      description: "Null when the player has no battle in the mode, or no snapshot carrying its counters.",
    }),
    from: z.coerce.date().nullable().meta({
      description:
        "The instant the window was read back from. These modes are read off the account, which Wargaming refreshes when the player logs out, so a battle window starts on a session boundary and can hold more than asked: read `stats.battles` for the real count.",
    }),
    truncated: z.boolean().meta({
      description:
        "The window reaches further back than our history of the mode on this account, so it covers everything since `from`.",
    }),
  })
  .meta({
    id: "PlayerModeStatWindow",
    description: "One period column of a mode tab of the profile, over a window the caller chose.",
  });
