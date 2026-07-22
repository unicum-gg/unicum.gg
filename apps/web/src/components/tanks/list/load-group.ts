"use client";

// Client-side loaders for a tank data group, used by TanksIndex to fetch the
// tabs that weren't server-seeded. `groupKey` is the SWR cache key (the SDK
// request's own URL, side-effect-free); `loadGroup` runs the fetch and reuses
// the shared builders so a lazily-loaded tab produces the same rows the server
// would have. SWR caches per key, so revisiting a tab is instant.
import { unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";
import {
  TankGroup,
  buildMasteryItems,
  buildMoeItems,
  buildSpecItems,
  buildStatsItems,
  type TankListItem,
} from "./build";

export function groupKey(region: Region, group: TankGroup): string {
  const api = unicum.region(region).tanks;
  switch (group) {
    case TankGroup.Stats:
      return api.list().url();
    case TankGroup.Specs:
      return api.specifications().url();
    case TankGroup.Moe:
      return api.marksOfExcellence().url();
    case TankGroup.Mastery:
      return api.marksOfMastery().url();
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the SDK response types are
   intentionally loose (looseObject); the shared builders type the rows. */
export async function loadGroup(
  region: Region,
  group: TankGroup,
): Promise<TankListItem[]> {
  const api = unicum.region(region).tanks;
  switch (group) {
    case TankGroup.Stats: {
      const r = await api.list();
      return buildStatsItems((r as any).results);
    }
    case TankGroup.Specs: {
      const [s, e] = await Promise.all([api.specifications(), api.economics()]);
      return buildSpecItems((s as any).results, (e as any).results);
    }
    case TankGroup.Moe: {
      const r = await api.marksOfExcellence();
      return buildMoeItems((r as any).results);
    }
    case TankGroup.Mastery: {
      const r = await api.marksOfMastery();
      return buildMasteryItems((r as any).results);
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
