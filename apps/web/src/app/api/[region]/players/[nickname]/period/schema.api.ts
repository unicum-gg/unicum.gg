// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod), so the stats table can import it too.
import { z } from "zod";
import { StatWindowUnit } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import { playerPeriodStats } from "../schema.api";

const playerStatWindowDerived = z
  .object({
    tier: z.number().nullable(),
    trackDamage: z.number().nullable(),
    spottingDamage: z.number().nullable(),
    assistingDamage: z.number().nullable(),
    combinedDamage: z.number().nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
  })
  .meta({
    id: "PlayerStatWindowDerived",
    description:
      "The figures computed from the per-vehicle breakdown over the window: average tier, assistance per battle, and the three WN ratings of those battles alone.",
  });

/** Response of `GET /{region}/players/{nickname}/period`. */
export const PlayerStatWindowResponse = z
  .object({
    accountId: z.number().int(),
    nickname: z.string(),
    window: z.object({
      unit: z.enum(StatWindowUnit).meta({
        description: "What the window counts: days from now, or the player's last battles.",
        "x-enum-source": "STAT_WINDOW_UNIT",
      } as EnumMeta),
      value: z.number().int(),
    }),
    stats: playerPeriodStats.nullable().meta({
      description: "Null when no snapshot of the account is held at all.",
    }),
    derived: playerStatWindowDerived,
    from: z.coerce.date().nullable().meta({
      description:
        "The instant the window was read back from. A battle window starts at the latest snapshot that sat at least that many battles back, so it can hold a few more than asked: read `stats.battles` for the real count.",
    }),
    truncated: z.boolean().meta({
      description:
        "The window reaches further back than our history of the account, so it covers everything since the account was first tracked (`from`).",
    }),
  })
  .meta({
    id: "PlayerStatWindow",
    description: "One period column of the profile's stats table, over a window the caller chose.",
  });
