// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums).
import { z } from "zod";
import { LoadoutMode } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

const classField = z.string().meta({
  description: "The client's class tag: heavyTank, mediumTank, lightTank, AT-SPG or SPG.",
});

const mapSpot = z
  .object({
    team: z.number().int().meta({ description: "The spawn the vehicle left, 1 or 2." }),
    vehicleClass: classField,
    left: z.number().meta({ description: "Minimap position, percent from the left edge." }),
    top: z.number().meta({ description: "Minimap position, percent from the top edge." }),
    settledAt: z.number().int().meta({
      description: "When it settled there, in seconds of battle time.",
    }),
    damage: z.number().int().meta({ description: "Its damage over the whole battle." }),
    kills: z.number().int(),
    survived: z.boolean(),
    won: z.boolean(),
  })
  .meta({
    id: "MapSpot",
    description: "The first place one vehicle held for twenty seconds within the first four minutes, and how its battle went.",
  });

const mapDamageSlice = z
  .object({
    team: z.number().int(),
    vehicleClass: classField,
    phase: z.number().int().meta({
      description: "0 for the first three minutes of battle time, 1 for three to seven, 2 past seven.",
    }),
    cells: z.array(z.number().int()).meta({
      description: "Cells of the damage grid as row * grid + column, row 0 at the top.",
    }),
    damage: z.array(z.number().int()).meta({
      description: "Damage dealt from each of the cells above, summed over the battles.",
    }),
  })
  .meta({ id: "MapDamageSlice" });

const mapKill = z
  .object({
    team: z.number().int(),
    vehicleClass: classField,
    left: z.number(),
    top: z.number(),
    at: z.number().int().meta({ description: "Seconds of battle time." }),
  })
  .meta({ id: "MapKill", description: "One killing shot, placed where it was fired from." });

const mapPositionLayout = z
  .object({
    arenaId: z.string().meta({ description: "The arena: the map, or a variant folded into it." }),
    gameplayId: z.string().meta({
      description: "The layout: ctf (Standard), domination (Encounter), assault, comp7. Positions are on that layout's own minimap.",
    }),
    mode: z.enum(LoadoutMode).meta({ "x-enum-source": "LOADOUT_MODE" } as EnumMeta),
    battles: z.number().int().meta({ description: "Battles counted." }),
    spots: z.array(mapSpot),
    damage: z.array(mapDamageSlice),
    kills: z.array(mapKill),
  })
  .meta({ id: "MapPositionLayout" });

export const MapPositionsResponse = z
  .object({
    arenaId: z.string(),
    grid: z.number().int().meta({ description: "Cells per side of the damage grid." }),
    layouts: z.array(mapPositionLayout).meta({ description: "Most battles first." }),
  })
  .meta({ id: "MapPositionsResponse" });
