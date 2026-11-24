import type { TankSpec } from "../db/schema";

/**
 * Whether a spec's rate of fire is set by heat rather than by its reload.
 *
 * The client's own test for it is an autoshoot gun whose clip holds its entire
 * ammunition (the `unlimitedClip` tag), and every gun carrying that tag also
 * carries the overheat mechanic. The parser has already turned those guns' rate
 * of fire into the client's sustained figure, which depends on how fast the gun
 * heats and cools and not at all on `reload`: the clip is never emptied, so its
 * reload never comes round. A reload change must therefore leave their rate of
 * fire alone, and recomputing it from the clip formula would bring back the
 * whole-belt-in-one-go figure the parser replaced.
 */
export function isHeatLimitedGun(spec: TankSpec): boolean {
  const clip = spec.clipSize;
  return clip != null && clip > 1 && clip === spec.ammoCapacity;
}
