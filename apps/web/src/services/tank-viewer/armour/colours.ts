// What a shot's outcome is painted in.
//
// These are the game's own answers made legible, not a palette choice, which is
// why they are not read from the site's tokens the way the floor is: red for a
// shot that never gets through and green for one that always does is a
// convention a player already knows, and moving it to fit a theme would cost
// more than it gained.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/live.html`.

/**
 * What a shell does where it lands.
 *
 * How often the shot gets through is a sliding thing, not three buckets, so it
 * reads as a ramp: red where it never does, through yellow at even odds, to
 * green where it always does. Two answers sit outside that scale and get a
 * colour of their own, because neither is a matter of odds: a shell that glances
 * off, and one whose calibre is three times the plate and so cannot be turned
 * away at all.
 */
export const RAMP = { none: 0xff0000, even: 0xffff00, always: 0x00ff00 } as const;

/** Anything that is not armour reads as one neutral grey. */
export const NOT_ARMOUR = 0xa6a6a6;

/**
 * The observation devices, which are neither armour nor quite a module like the
 * others: they are the thing a player aims at to blind a tank without killing
 * it, so they get a colour that says "here", not "steel".
 */
export const OPTICS = 0xe14dff;

/** The answers that sit outside the odds, each with what it means. */
export const OUTCOME = {
  ricochet: { colour: 0xff66ff, label: "glances off, whatever the shell" },
  overmatch: { colour: 0x00ffff, label: "overmatched, cannot be turned away" },
  screen: { colour: NOT_ARMOUR, label: "a screen or track, nothing behind" },
  module: { colour: NOT_ARMOUR, label: "a module, not armour" },
  unknown: { colour: NOT_ARMOUR, label: "no thickness published" },
} as const;

/**
 * A colour handed to the shader as the value that must reach the screen.
 *
 * **These are not lights, they are labels.** Given to three the usual way, a
 * colour is taken as sRGB and converted into the renderer's linear working
 * space, and this view composites through a float target of its own rather than
 * one of three's materials, so nothing ever converts it back. Every grey then
 * arrives about a stop darker than it was chosen to be.
 */
export function swatch(three: typeof import("three"), hex: number) {
  return new three.Color().setHex(hex, three.NoColorSpace);
}
