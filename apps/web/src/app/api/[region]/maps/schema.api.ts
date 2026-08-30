// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  mapBattleTypeField,
  mapCamouflageField,
  mapModeField,
} from "@/services/openapi/schemas";

// A point projected onto the minimap image, as percentages (0-100) from the
// top-left, ready to position an absolutely-placed marker. Shared with the
// per-mode geometry on the detail response.
export const mapMarker = z.object({ left: z.number(), top: z.number() });
export const teamMarkers = z.object({
  team1: z.array(mapMarker),
  team2: z.array(mapMarker),
});

export const mapVariantSummary = z
  .object({
    arenaId: z.string(),
    battleType: mapBattleTypeField,
    minimapUrl: z.string(),
    commonTest: z.boolean().meta({
      description:
        "Whether only the Common Test client ships this variant's space, so it cannot be played on the live server yet.",
    }),
  })
  .meta({
    id: "MapVariantSummary",
    description: "One variant of a map, as the gallery reads it.",
  });

export const mapSummary = z
  .object({
    arenaId: z.string(),
    slug: z.string(),
    name: z.string(),
    camouflage: mapCamouflageField,
    sizeMeters: z.number().meta({ description: "Square side length in metres." }),
    modes: z.array(mapModeField),
    battleTypes: z.array(mapBattleTypeField),
    minimapUrl: z.string(),
    bases: teamMarkers.meta({
      description: "Standard-mode base positions, for the gallery thumbnail.",
    }),
    hasRandomEvents: z.boolean().meta({
      description: "Whether random events might fire on the map mid-battle.",
    }),
    commonTest: z.boolean().meta({
      description:
        "Whether only the Common Test client ships this map's space, so it cannot be played on the live server yet.",
    }),
    variants: z.array(mapVariantSummary).meta({
      description:
        "The arenas the client ships under this map's name for a mode of their own (Waffenträger, Last Stand, Story Mode, Onslaught night), each a view of this map rather than a map.",
    }),
  })
  .meta({ id: "MapSummary", description: "A battle map's gallery summary." });

/** Response of `GET /{region}/maps` (every battle map on the region). */
export const MapsListResponse = z.object({ results: z.array(mapSummary) });
