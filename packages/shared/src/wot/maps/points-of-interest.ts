/**
 * The kinds of Point of Interest an Onslaught map places, numbered as the game
 * numbers them in the arena definition. Taking one gives the team a tactical
 * skill, so the kind is what a player reads off the minimap.
 *
 * The Artillery Headquarters (an artillery strike on a chosen position) is on
 * every Onslaught map. The Comms Center (which spots enemy vehicles) is the one
 * the Observation Post replaces on the night versions of a map: its flare lights
 * an area for 25 seconds, spotting the enemies inside it and leaving them taking
 * 10% more damage while the lit area shrinks.
 */
export enum MapPoiType {
  ArtilleryHeadquarters = 1,
  CommsCenter = 2,
  ObservationPost = 3,
}

export const MAP_POI_LABEL: Record<MapPoiType, string> = {
  [MapPoiType.ArtilleryHeadquarters]: "Artillery Headquarters",
  [MapPoiType.CommsCenter]: "Comms Center",
  [MapPoiType.ObservationPost]: "Observation Post",
};

/** Read a raw arena-definition point type as a known kind, or null for one the
 * game has added since. Kept as a lookup rather than a cast so an unknown value
 * is a case the renderer handles instead of a mislabelled marker. */
export function mapPoiType(raw: number): MapPoiType | null {
  return raw in MAP_POI_LABEL ? (raw as MapPoiType) : null;
}
