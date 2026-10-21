"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_TANK_BATTLE_MODE,
  TankBattleMode,
  tankBattleMode,
} from "@unicum.gg/shared";
import { sharedParamStore } from "@/lib/url-param-store";

/** The param the garage table's mode view is addressed by. */
export const TANK_MODE_PARAM = "mode";

const store = sharedParamStore(TANK_MODE_PARAM);

/**
 * Which battle mode the garage table is showing, held in the URL.
 *
 * In the URL rather than in state because it changes what the table SAYS: a
 * reader who finds their Skirmish record worth sending to a clanmate has to be
 * able to send it, and the endpoint takes the same `mode` so the link and the
 * fetch cannot disagree. `replaceState` like every other param store, since it
 * is a view of one page rather than a new one.
 *
 * Never null: there is no "overall" mode in the game, so the default is Random
 * Battles and the param is simply absent for it, the way the first page of a
 * table carries no `?page=`. An unparsable value reads as the default rather
 * than throwing, matching the endpoint, which answers rather than 400s on a
 * mode it does not know so a bookmark cannot rot into an error.
 */
export function useTankMode(): [TankBattleMode, (next: TankBattleMode) => void] {
  const mode = useSyncExternalStore(
    store.subscribe,
    () => tankBattleMode(store.read()) ?? DEFAULT_TANK_BATTLE_MODE,
    // Server-rendered with no mode: `useSearchParams` is empty on a static page
    // by design, so the first paint is the default either way and the param is
    // applied on hydration.
    () => DEFAULT_TANK_BATTLE_MODE,
  );
  const setMode = useCallback((next: TankBattleMode) => {
    store.write(next === DEFAULT_TANK_BATTLE_MODE ? null : next);
  }, []);
  return [mode, setMode];
}

/**
 * A path with the battle mode on it, which is how the mode travels.
 *
 * The default carries no param, the way the first page of a table carries no
 * `?page=`, so the canonical URL of a vehicle record stays the bare one. Used
 * by every link that has to keep the reader in the mode they are reading: a row
 * of the garage table opening its record, and a profile mode tab leading to the
 * same mode vehicle by vehicle.
 */
export function withTankMode(path: string, mode: TankBattleMode): string {
  if (mode === DEFAULT_TANK_BATTLE_MODE) return path;
  // `?` or `&` depending on what the path already carries. A bare `?` was
  // correct only because today's two callers happen to pass clean paths: the
  // first link that arrives with a `?page=` would have produced
  // `...?page=2?mode=skirmish`, which parses as one param called `page` and
  // loses the mode without a word.
  const [base, hash = ""] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${TANK_MODE_PARAM}=${mode}${hash ? `#${hash}` : ""}`;
}
