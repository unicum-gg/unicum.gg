// Random-battle game modes we surface, mapped from the raw wot-src gameplay
// tokens (`ctf`, `domination`, `assault`, `assault2`). Training / comp7 /
// battle-royale tokens have no entry and are dropped.
export enum MapGameMode {
  Standard = "standard",
  Encounter = "encounter",
  Assault = "assault",
  /**
   * The Global Map / Clan Wars mode, which the client calls `assault2`.
   *
   * NOT a second flavour of Assault, which is how it was read until the arena
   * data was checked: the thirteen arenas that declare it all give the same
   * shape, TWO bases to one team and none to the other, while Assault gives one
   * base and none. Two defended bases against an attacker with no base of its
   * own is Attack/Defense, and every one of those thirteen is an Attack/Defense
   * map. The tournament catalogue in `@unicum.gg/wargaming` already reads the
   * very same token as `AttackDefense`, so folding it into Assault here left our
   * own two halves disagreeing about what one token means.
   */
  AttackDefense = "attack-defense",
}

export const MAP_GAME_MODE_LABEL: Record<MapGameMode, string> = {
  [MapGameMode.Standard]: "Standard",
  [MapGameMode.Encounter]: "Encounter",
  [MapGameMode.Assault]: "Assault",
  [MapGameMode.AttackDefense]: "Attack/Defense",
};

/** Map a raw wot-src gameplay token to a surfaced mode, or null to drop it. */
export function gameModeFromRaw(raw: string): MapGameMode | null {
  switch (raw) {
    case "ctf":
      return MapGameMode.Standard;
    case "domination":
      return MapGameMode.Encounter;
    case "assault":
      return MapGameMode.Assault;
    case "assault2":
      return MapGameMode.AttackDefense;
    default:
      return null;
  }
}
