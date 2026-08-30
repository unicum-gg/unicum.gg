// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { mapModeField } from "@/services/openapi/schemas";
import {
  mapMarker,
  mapSummary,
  mapVariantSummary,
  teamMarkers,
} from "../schema.api";

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
    arenaId: z.string().meta({
      description:
        "The arena this layout is defined by: the map itself, or the dedicated Onslaught arena the client ships beside it.",
    }),
    minimapUrl: z.string(),
    widthMeters: z.number(),
    heightMeters: z.number(),
    spawns: teamMarkers,
    controlPoint: mapMarker.nullable(),
    pointsOfInterest: z.array(
      z.object({
        marker: mapMarker,
        type: z.number().meta({
          description:
            "What taking the point gives the team: 1 artillery strike, 2 recon, 3 illumination flare.",
        }),
      }),
    ),
  })
  .meta({
    id: "MapOnslaught",
    description: "One Onslaught (comp7) layout: minimap, reduced play area and geometry.",
  });

const mapRandomEvent = z
  .object({
    id: z.string(),
    name: z.string(),
    zoneUrls: z.array(z.string()).meta({
      description:
        "Minimap overlays marking where the event strikes, as the game marks it before it happens.",
    }),
    afterUrls: z.array(z.string()).meta({
      description:
        "Minimap overlays redrawing the ground the event leaves behind.",
    }),
  })
  .meta({
    id: "MapRandomEvent",
    description:
      "An event that might fire on the map mid-battle, with the minimap art of its danger area and of its aftermath.",
  });

/** Response of `GET /{region}/maps/{slug}` (a single map with its geometry). */
const mapVariantLayout = mapVariantSummary
  .extend({
    widthMeters: z.number(),
    heightMeters: z.number(),
    geometry: z.array(mapModeGeometry),
    onslaught: mapOnslaught.nullable(),
  })
  .meta({
    id: "MapVariantLayout",
    description: "A map's variant with everything a view of it needs.",
  });

export const MapDetailResponse = mapSummary
  .extend({
    description: z.string(),
    roundLength: z.number().meta({ description: "Battle timer in seconds." }),
    maxPlayersInTeam: z.number(),
    widthMeters: z.number(),
    heightMeters: z.number(),
    geometry: z.array(mapModeGeometry),
    onslaught: mapOnslaught.nullable().meta({
      description:
        "The Onslaught layout the map's own arena declares, null when it has none. A night version's layout is in `variants`.",
    }),
    variants: z.array(mapVariantLayout).meta({
      description:
        "The map's variants in full, each its own arena drawn as its own view.",
    }),
    randomEvents: z.array(mapRandomEvent),
  })
  .meta({ id: "MapDetail", description: "A battle map with its full geometry." });
