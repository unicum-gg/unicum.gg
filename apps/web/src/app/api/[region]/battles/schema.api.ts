// Co-located request and response schemas (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { BattleCatalogSort, BattleResultFilter } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import { answerLanguageField } from "@/services/openapi/locale";
import {
  playerBattle,
  playerBattleFacets,
} from "@/app/api/[region]/players/[nickname]/battles/schema.api";

/** Query of `GET /{region}/battles`. */
export const battlesCatalogQuery = z.object({
  language: answerLanguageField.optional(),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .meta({
      description:
        "Which page of `limit` battles, counted from one. The first by default; `total` in the answer says how many there are.",
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .meta({ description: "Battles per page, 20 by default, 100 at most." }),
  sort: z
    .enum(BattleCatalogSort)
    .optional()
    .meta({
      description:
        "What the replays are ranked by: the damage their recorder dealt (`damage`, the default), their assisted damage, experience or kills, the newest first (`recent`), or the most opened (`views`) or downloaded (`downloads`).",
      "x-enum-source": "BATTLE_CATALOG_SORT",
    } as EnumMeta),
  mode: z.coerce
    .number()
    .int()
    .optional()
    .meta({
      description:
        "Only battles of this mode, by the game's own `bonusType` (1 is random battles). `facets.modes` lists the ones the catalogue has.",
    }),
  tank: z.coerce
    .number()
    .int()
    .optional()
    .meta({
      description:
        "Only replays recorded in this vehicle, by its tank id. `facets.tanks` lists the ones the catalogue has.",
    }),
  map: z
    .string()
    .optional()
    .meta({
      description:
        "Only battles on this arena, by the game's own map id (`05_prohorovka`). `facets.maps` lists the ones the catalogue has.",
    }),
  result: z
    .enum(BattleResultFilter)
    .optional()
    .meta({
      description: "Only replays whose recorder won, lost or drew.",
      "x-enum-source": "BATTLE_RESULT_FILTER",
    } as EnumMeta),
  version: z
    .string()
    .optional()
    .meta({
      description:
        "Only battles of this game update, as `2.4.1` (any hotfix of it), or `latest` for the newest update the catalogue holds. `versions` lists the ones it has.",
    }),
  facets: z
    .enum(["true", "false"])
    .optional()
    .meta({ description: "`true` to also answer what each filter can take, counted." }),
});

const battlesCatalogPlayer = z
  .object({
    nickname: z.string(),
    accountId: z.number().int(),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable(),
    isVerified: z.boolean(),
    isSupporter: z.boolean(),
    twitchLogin: z.string().nullable(),
    tournamentWins: z.number().int(),
    tournamentFeaturedWins: z.number().int(),
    tournamentBestTitle: z.string().nullable(),
    onslaughtBestTier: z.string().nullable(),
    onslaughtBestRank: z.number().int().nullable(),
    onslaughtSeasons: z.number().int(),
  })
  .meta({ id: "BattlesCatalogPlayer" });

const battlesCatalogEntry = z
  .object({
    player: battlesCatalogPlayer,
    stats: z
      .object({ views: z.number().int(), downloads: z.number().int() })
      .meta({
        id: "BattlesCatalogStats",
        description:
          "How often this recording's page was opened and its file downloaded, each counted at most once an hour per address.",
      }),
    battle: playerBattle.meta({
      description:
        "The battle from the recorder's side, exactly as their own Battles tab answers it, loadout included.",
    }),
  })
  .meta({
    id: "BattlesCatalogEntry",
    description: "One archived replay, drawn from the player who recorded it.",
  });

/** Response of `GET /{region}/battles`. */
export const BattlesCatalogResponse = z
  .object({
    battles: z.array(battlesCatalogEntry),
    total: z.number().int().meta({
      description: "How many battles match the filters across every page.",
    }),
    facets: playerBattleFacets.optional().meta({
      description: "Present when `facets=true` was asked for, counted over the whole catalogue.",
    }),
    version: z.string().nullable().meta({
      description: "The game update the list is narrowed to, `latest` resolved, or null for every update.",
    }),
    versions: z
      .array(z.object({ value: z.string(), count: z.number().int() }))
      .optional()
      .meta({
        description: "The game updates the catalogue holds battles from, newest first, counted. Present with `facets=true`.",
      }),
  })
  .meta({
    id: "BattlesCatalogResponse",
    description:
      "Every battle whose replay file was archived, from the mod or from a replay uploaded on the site.",
  });
