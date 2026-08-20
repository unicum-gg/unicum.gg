"use client";

import type { DecodedConfig } from "@/components/tanks/detail/specifications/config-url";
import {
  DefaultModules,
  useTankBuild,
  type TankBuild,
  type TankBuildData,
} from "@/hooks/use-tank-build";

/** A column with no vehicle in it. One shared instance so the unused builds keep
 * a stable identity across renders and never invalidate a memo. */
const NO_VEHICLE: TankBuildData = {
  stockSpecs: null,
  modules: [],
  configs: [],
  loadout: null,
  crew: null,
  fieldMods: null,
  skillTree: null,
  modes: [],
};

const OPTIONS = { defaultModules: DefaultModules.Top };

/**
 * One live build per compared vehicle, all readable together.
 *
 * The comparison needs every column's characteristics at once (to colour the
 * best value of a row, and to diff against the pinned column), and a build is a
 * hook, so the alternative is a child component per column publishing its specs
 * back up through an effect: a render where the table is empty before the
 * effects land, which is what the server would send and what a reader would see
 * first. Calling the hook a fixed number of times instead keeps every column's
 * numbers available on the very first render, server included.
 *
 * The count is fixed because the rules of hooks require it, so unused slots run
 * on an empty vehicle and are sliced off. That is the whole reason
 * `MAX_COMPARE_TANKS` is a ceiling and not a preference: raising it means adding
 * calls here.
 *
 * State lives per column index, so the caller must remount this on a change of
 * composition (a `key` over the compared slugs) or a removed column would leave
 * its equipment on whichever vehicle shifts into its place.
 */
export function useCompareBuilds(
  data: TankBuildData[],
  seeds: (DecodedConfig | undefined)[],
): TankBuild[] {
  const b0 = useTankBuild(data[0] ?? NO_VEHICLE, seeds[0], OPTIONS);
  const b1 = useTankBuild(data[1] ?? NO_VEHICLE, seeds[1], OPTIONS);
  const b2 = useTankBuild(data[2] ?? NO_VEHICLE, seeds[2], OPTIONS);
  const b3 = useTankBuild(data[3] ?? NO_VEHICLE, seeds[3], OPTIONS);
  return [b0, b1, b2, b3].slice(0, data.length);
}
