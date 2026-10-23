"use client";

import { useSyncExternalStore } from "react";
import { BattleResultFilter } from "@unicum.gg/shared";
import { sharedParamStore } from "@/lib/url-param-store";
import PAGINATION from "@/constants/pagination";

/** The battles list's filters, as the endpoint takes them. */
export type BattleFilterState = {
  mode?: number;
  tank?: number;
  map?: string;
  result?: BattleResultFilter;
};

/** Which filter, and the query param it rides in. */
export enum BattleFilterKey {
  Mode = "mode",
  Tank = "tank",
  Map = "map",
  Result = "result",
}

const nullSnapshot = () => null;

const asInt = (raw: string | null): number | undefined => {
  const value = Number(raw);
  return raw && Number.isInteger(value) ? value : undefined;
};

/**
 * The battles list's filters, held in the URL like its page.
 *
 * In the address bar rather than in state so a filtered list is a link: "every
 * Onslaught battle I lost on the Obj. 140" is something a player sends to a
 * friend. Any change returns to the first page, since the reader's place in
 * the old list names different rows in the new one.
 */
export function useBattleFilter(): {
  filter: BattleFilterState;
  set: (key: BattleFilterKey, value: string | null) => void;
  clear: () => void;
} {
  const stores = {
    [BattleFilterKey.Mode]: sharedParamStore(BattleFilterKey.Mode),
    [BattleFilterKey.Tank]: sharedParamStore(BattleFilterKey.Tank),
    [BattleFilterKey.Map]: sharedParamStore(BattleFilterKey.Map),
    [BattleFilterKey.Result]: sharedParamStore(BattleFilterKey.Result),
  };
  const page = sharedParamStore(PAGINATION.PARAM);
  const modeStore = stores[BattleFilterKey.Mode];
  const tankStore = stores[BattleFilterKey.Tank];
  const mapStore = stores[BattleFilterKey.Map];
  const resultStore = stores[BattleFilterKey.Result];
  const mode = useSyncExternalStore(modeStore.subscribe, modeStore.read, nullSnapshot);
  const tank = useSyncExternalStore(tankStore.subscribe, tankStore.read, nullSnapshot);
  const map = useSyncExternalStore(mapStore.subscribe, mapStore.read, nullSnapshot);
  const result = useSyncExternalStore(resultStore.subscribe, resultStore.read, nullSnapshot);

  return {
    filter: {
      mode: asInt(mode),
      tank: asInt(tank),
      map: map || undefined,
      result: Object.values(BattleResultFilter).includes(result as BattleResultFilter)
        ? (result as BattleResultFilter)
        : undefined,
    },
    set: (key, value) => {
      stores[key].write(value);
      page.write(null);
    },
    clear: () => {
      for (const store of Object.values(stores)) store.write(null);
      page.write(null);
    },
  };
}
