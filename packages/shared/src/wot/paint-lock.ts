// Whether the game lets a vehicle be dressed at all.
//
// Most of what a player can put on a tank is decided by the customization
// items themselves: every camouflage carries a vehicle filter, and a style is
// offered wherever its camouflage is. That filter is not where the refusals
// live. A hundred and eleven vehicles are locked by the vehicle's own
// definition instead, and the client reads two different things to know it, so
// a wardrobe built from the filters alone offers paint on every one of them.

/** Why World of Tanks refuses to dress a vehicle. */
export enum PaintLock {
  /**
   * Customization is off entirely, from the `lockOutfit` tag.
   *
   * The client disables the garage's whole customization entry for these: the
   * mode-locked machines nobody owns (Steel Hunter, Story Mode, onboarding),
   * and the reward vehicles that ARE a style, handed out already wearing the
   * one outfit they exist for.
   */
  Locked = "locked",
  /**
   * It left the factory painted, from the vehicle's `customDefaultCamouflage`.
   *
   * Thirty-one premiums wear a livery drawn into their own textures: the
   * Skorpion G, the Tiger 131, the Pz. 58 Mutz, the T26E5 Patriot. The client
   * dresses them in a camouflage of its own (the hidden id 1, over the whole
   * hull), refuses to let that one be installed by hand, and locks the style
   * list wherever it offers one. Twenty-six of them also carry
   * `lockExceptProgression`, which leaves only the progression decals, and none
   * of those is paint either.
   */
  Factory = "factory",
}

/** The vehicle tag that turns customization off outright. */
const LOCKED = "lockOutfit";

/** The tag that leaves only the progression decals, which are not paint. */
const PROGRESSION_ONLY = "lockExceptProgression";

/**
 * Why this vehicle cannot be painted, or null where it can.
 *
 * Both signals come from the client and neither is derivable from the other:
 * the tags sit in the nation's index and the livery flag in the vehicle's own
 * file. They do not overlap today (`lockOutfit` and `customDefaultCamouflage`
 * name disjoint sets), and `lockExceptProgression` currently implies the
 * livery, but it is read on its own rather than through it: a vehicle the
 * client someday allows a progression decal on and nothing else is still one no
 * reader can paint.
 */
export function paintLockOf(
  tags: readonly string[],
  /** The vehicle's own `customDefaultCamouflage`, true where it has a livery. */
  factoryLivery: boolean,
): PaintLock | null {
  if (tags.includes(LOCKED)) return PaintLock.Locked;
  if (factoryLivery || tags.includes(PROGRESSION_ONLY)) return PaintLock.Factory;
  return null;
}
