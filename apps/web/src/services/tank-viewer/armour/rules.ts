// The penetration rules, worked out on the processor rather than per pixel.
//
// **This is the shader's `RULES` block again, in another language.** The picture
// is drawn on the card and the readout is written here, so the two can only
// agree by being the same arithmetic twice, and any change to one belongs in the
// other in the same breath. They are kept apart because a shader cannot hand
// back a sentence and a sentence cannot be drawn a million times a frame.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/live.html`.
import type { Shot } from "./index";
import { RAMP } from "./colours";
import { SOLID_SHOT, SPREAD } from "./shaders";

/** What the game works out at one plate, in millimetres of steel. */
export type Resolved = {
  /** Turned away whatever else is true: nothing behind it is reached. */
  ricochet: boolean;
  /** The plate as the shell meets it, stretched by the angle it kept. */
  effective: number;
  /** Degrees the shell straightened by, the two-calibre rule included. */
  straighten: number;
  /** Its calibre reached three times the plate, so it cannot be turned away. */
  overmatch: boolean;
  /** A hole in the hull rather than steel: there is nothing here to beat. */
  opening: boolean;
};

/** What one plate does to one shell arriving at `angle` off its normal. */
export function resolve(shot: Shot, thickness: number, angle: number): Resolved {
  const rules = SOLID_SHOT.test(shot.kind);
  // An opening: no steel to straighten against, turn away or overmatch.
  if (thickness <= 0) {
    return { ricochet: false, effective: 0, straighten: 0, overmatch: false, opening: true };
  }
  let straighten = shot.normalisation;
  if (rules && shot.caliber > 2 * thickness) {
    straighten *= (1.4 * shot.caliber) / (2 * thickness);
  }
  const overmatch = rules && shot.caliber >= 3 * thickness;
  if (!overmatch && angle >= shot.ricochet) {
    return { ricochet: true, effective: Infinity, straighten, overmatch, opening: false };
  }
  const left = Math.max(angle - straighten, 0);
  return {
    ricochet: false,
    effective: thickness / Math.max(Math.cos((left * Math.PI) / 180), 0.02),
    straighten,
    overmatch,
    opening: false,
  };
}

/**
 * How often a shell of this penetration beats `total` millimetres.
 *
 * The game rolls its penetration over a band either side of the nominal figure,
 * so the answer is a share rather than a yes: 1 where the worst roll still gets
 * through, 0 where the best roll does not.
 */
export function odds(penetration: number, total: number): number {
  const low = penetration * (1 - SPREAD);
  const high = penetration * (1 + SPREAD);
  return Math.min(Math.max((high - total) / Math.max(high - low, 0.001), 0), 1);
}

/** The colour those odds are painted, the same ramp the picture uses. */
export function onRamp(chance: number): number {
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  const parts = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
  const [from, to, t] =
    chance > 0.5
      ? ([RAMP.even, RAMP.always, (chance - 0.5) * 2] as const)
      : ([RAMP.none, RAMP.even, chance * 2] as const);
  const a = parts(from);
  const b = parts(to);
  return (lerp(a[0], b[0], t) << 16) | (lerp(a[1], b[1], t) << 8) | lerp(a[2], b[2], t);
}
