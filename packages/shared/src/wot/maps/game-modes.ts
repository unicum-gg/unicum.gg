// Random-battle game modes we surface, mapped from the raw wot-src gameplay
// tokens (`ctf`, `domination`, `assault`/`assault2`). Training / comp7 /
// battle-royale tokens have no entry and are dropped.
export enum MapGameMode {
  Standard = "standard",
  Encounter = "encounter",
  Assault = "assault",
}

export const MAP_GAME_MODE_LABEL: Record<MapGameMode, string> = {
  [MapGameMode.Standard]: "Standard",
  [MapGameMode.Encounter]: "Encounter",
  [MapGameMode.Assault]: "Assault",
};

/** Map a raw wot-src gameplay token to a surfaced mode, or null to drop it. */
export function gameModeFromRaw(raw: string): MapGameMode | null {
  switch (raw) {
    case "ctf":
      return MapGameMode.Standard;
    case "domination":
      return MapGameMode.Encounter;
    case "assault":
    case "assault2":
      return MapGameMode.Assault;
    default:
      return null;
  }
}
