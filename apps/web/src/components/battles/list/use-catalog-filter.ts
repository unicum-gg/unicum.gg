"use client";

import { useSyncExternalStore } from "react";
import {
  BattleMode,
  BattleResultFilter,
  LATEST_BATTLE_VERSION,
} from "@unicum.gg/shared";
import { sharedParamStore } from "@/lib/url-param-store";
import PAGINATION from "@/constants/pagination";
import {
  BattleFilterKey,
  type BattleFilterState,
} from "@/components/players/detail/battles/use-battle-filter";

/** The query param the game update rides in. */
export const VERSION_PARAM = "version";

/**
 * What a param holds to mean "every value" where its absence means the default.
 * The catalogue opens on random battles of the current update, so an empty URL
 * already filters, and taking a filter off has to be written down.
 */
export const ALL = "all";

/** The mode the catalogue opens on: random battles, what most replays are
 * looked up for. */
const DEFAULT_MODE = BattleMode.Random;

/** The catalogue's filters, with the game update beside the profile's four. */
export type CatalogFilterState = BattleFilterState & {
  /** `2.4.1`, `latest` for the newest the catalogue holds, or absent for all. */
  version?: string;
};

const nullSnapshot = () => null;

const asInt = (raw: string | null): number | undefined => {
  const value = Number(raw);
  return raw && Number.isInteger(value) ? value : undefined;
};

/**
 * The replay catalogue's filters, held in the URL like a player's own.
 *
 * Two of them have defaults rather than "nothing": the mode (random battles)
 * and the game update (the newest), so `?mode=all` and `?version=all` are what
 * lift them, and a filter set back to its default leaves the URL clean. Any
 * change returns to the first page.
 */
export function useCatalogFilter(): {
  filter: CatalogFilterState;
  /** Whether anything differs from the defaults, which is what "clear" undoes. */
  changed: boolean;
  set: (key: BattleFilterKey | typeof VERSION_PARAM, value: string | null) => void;
  clear: () => void;
} {
  const stores = {
    [BattleFilterKey.Mode]: sharedParamStore(BattleFilterKey.Mode),
    [BattleFilterKey.Tank]: sharedParamStore(BattleFilterKey.Tank),
    [BattleFilterKey.Map]: sharedParamStore(BattleFilterKey.Map),
    [BattleFilterKey.Result]: sharedParamStore(BattleFilterKey.Result),
    [VERSION_PARAM]: sharedParamStore(VERSION_PARAM),
  };
  const page = sharedParamStore(PAGINATION.PARAM);
  const modeStore = stores[BattleFilterKey.Mode];
  const tankStore = stores[BattleFilterKey.Tank];
  const mapStore = stores[BattleFilterKey.Map];
  const resultStore = stores[BattleFilterKey.Result];
  const versionStore = stores[VERSION_PARAM];
  const mode = useSyncExternalStore(modeStore.subscribe, modeStore.read, nullSnapshot);
  const tank = useSyncExternalStore(tankStore.subscribe, tankStore.read, nullSnapshot);
  const map = useSyncExternalStore(mapStore.subscribe, mapStore.read, nullSnapshot);
  const result = useSyncExternalStore(resultStore.subscribe, resultStore.read, nullSnapshot);
  const version = useSyncExternalStore(versionStore.subscribe, versionStore.read, nullSnapshot);

  return {
    filter: {
      mode: mode === null ? DEFAULT_MODE : mode === ALL ? undefined : asInt(mode),
      tank: asInt(tank),
      map: map || undefined,
      result: Object.values(BattleResultFilter).includes(result as BattleResultFilter)
        ? (result as BattleResultFilter)
        : undefined,
      version:
        version === null ? LATEST_BATTLE_VERSION : version === ALL ? undefined : version,
    },
    changed: [mode, tank, map, result, version].some((raw) => raw !== null),
    set: (key, value) => {
      if (key === BattleFilterKey.Mode) {
        // Off is written as "all", the default as nothing.
        stores[key].write(
          value === null ? ALL : Number(value) === DEFAULT_MODE ? null : value,
        );
      } else if (key === VERSION_PARAM) {
        stores[key].write(
          value === null ? ALL : value === LATEST_BATTLE_VERSION ? null : value,
        );
      } else {
        stores[key].write(value);
      }
      page.write(null);
    },
    clear: () => {
      for (const store of Object.values(stores)) store.write(null);
      page.write(null);
    },
  };
}
