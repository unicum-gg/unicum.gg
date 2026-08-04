// Vehicle camouflage kind a map is skinned with. The raw token is kept as the
// enum value so it round-trips through the wire unchanged.
export enum MapCamouflage {
  Summer = "summer",
  Winter = "winter",
  Desert = "desert",
}

export const MAP_CAMOUFLAGE_LABEL: Record<MapCamouflage, string> = {
  [MapCamouflage.Summer]: "Summer",
  [MapCamouflage.Winter]: "Winter",
  [MapCamouflage.Desert]: "Desert",
};

export function mapCamouflage(raw: string): MapCamouflage {
  return raw === MapCamouflage.Winter || raw === MapCamouflage.Desert
    ? (raw as MapCamouflage)
    : MapCamouflage.Summer;
}
