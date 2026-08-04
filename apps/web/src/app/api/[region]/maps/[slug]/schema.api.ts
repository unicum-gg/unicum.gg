// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { mapModeField } from "@/services/openapi/schemas";
import { mapMarker, mapSummary, teamMarkers } from "../schema.api";

const mapModeGeometry = z
  .object({
    mode: mapModeField,
    label: z.string(),
    bases: teamMarkers,
    spawns: teamMarkers,
    controlPoint: mapMarker.nullable(),
  })
  .meta({
    id: "MapModeGeometry",
    description: "Base flags, team spawns and control point for one game mode.",
  });

const mapOnslaught = z
  .object({
    minimapUrl: z.string(),
    widthMeters: z.number(),
    heightMeters: z.number(),
    spawns: teamMarkers,
    controlPoint: mapMarker.nullable(),
    pointsOfInterest: z.array(
      z.object({ marker: mapMarker, type: z.number() }),
    ),
  })
  .meta({
    id: "MapOnslaught",
    description: "Onslaught (comp7) minimap, reduced play area and geometry.",
  });

/** Response of `GET /{region}/maps/{slug}` (a single map with its geometry). */
export const MapDetailResponse = mapSummary
  .extend({
    description: z.string(),
    roundLength: z.number().meta({ description: "Battle timer in seconds." }),
    maxPlayersInTeam: z.number(),
    widthMeters: z.number(),
    heightMeters: z.number(),
    geometry: z.array(mapModeGeometry),
    onslaught: mapOnslaught.nullable(),
  })
  .meta({ id: "MapDetail", description: "A battle map with its full geometry." });
