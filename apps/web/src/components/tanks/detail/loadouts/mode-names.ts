import { LoadoutMode } from "@unicum.gg/shared";

/**
 * Where each mode's name is read in `game/vocabulary`: the game's own words,
 * in the reader's language, as the profile's mode tabs already name them.
 *
 * A module of its own so client components (the map's positioning guide) can
 * name a mode without importing the server-rendered Loadouts tab.
 */
export const LOADOUT_MODE_NAME_KEY: Record<LoadoutMode, string> = {
  [LoadoutMode.Random]: "player-modes.overall",
  [LoadoutMode.Onslaught]: "player-modes.onslaught",
  [LoadoutMode.Skirmish]: "player-modes.skirmish",
  [LoadoutMode.Advance]: "player-modes.advances",
};
