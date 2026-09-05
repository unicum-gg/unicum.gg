// What is under the cursor, and what a shell would make of it.
//
// The picture answers the same question for every pixel at once and cannot say
// why; this walks one ray and can. It is the readout's whole substance, and it
// runs the same arithmetic the shader does, from `rules.ts`.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/live.html`.
import type * as Three from "three";

import type { Shot } from "./index";
import type { PlateFacts } from "./plates";
import { type Resolved, odds as oddsOf, onRamp, resolve } from "./rules";
import { NOT_ARMOUR, OUTCOME } from "./colours";

/** One surface the shot passes into, in the order it meets them. */
export type Layer = PlateFacts & {
  /** Degrees off the plate's own normal, which is what stretches it. */
  angle: number;
  /** What the plate does to the shell, or null where there is nothing to do. */
  step: Resolved | null;
};

/** What the shot comes to, once every layer is counted. */
export type Impact = {
  layers: Layer[];
  /** Millimetres of steel in the way, null where nothing of the vehicle is. */
  effective: number | null;
  /** Share of rolls that get through, null where the question does not apply. */
  odds: number | null;
  outcome: keyof typeof OUTCOME | "through";
  label: string;
  colour: number;
};

/**
 * Walk the shot in from the cursor.
 *
 * **Only faces turned towards the ray are layers.** A collision mesh is a shell,
 * so every plate is crossed twice, and the far side is the way out rather than
 * another thing to beat.
 *
 * **And the walk stops at the vehicle.** A screen adds its thickness to whatever
 * stands behind it, so the layers run screen, screen, plate, and end there: that
 * plate is where the shell either stops or does its damage, and anything past it
 * is already inside.
 */
export function probe(
  three: typeof import("three"),
  raycaster: Three.Raycaster,
  plates: Three.Mesh[],
  shot: Shot | null,
  byThickness: boolean,
): Impact | null {
  const hits = raycaster.intersectObjects(plates, false);
  const direction = raycaster.ray.direction;
  const normalMatrix = new three.Matrix3();
  const layers: Layer[] = [];

  for (const hit of hits) {
    if (!hit.face) continue;
    const normal = hit.face.normal
      .clone()
      .applyMatrix3(normalMatrix.getNormalMatrix(hit.object.matrixWorld))
      .normalize();
    // A face turned away is the way out, not the way in.
    if (normal.dot(direction) >= 0) continue;
    const facts = hit.object.userData as PlateFacts;
    const angle = (Math.acos(Math.min(Math.abs(normal.dot(direction)), 1)) * 180) / Math.PI;
    const resolvable = shot && !facts.module && facts.thickness !== null;
    layers.push({
      ...facts,
      angle,
      step: resolvable ? resolve(shot, facts.thickness ?? 0, angle) : null,
    });
    if (!facts.spaced) break;
  }

  if (layers.length === 0) return null;

  // Reading the plate rather than the shot: no shell comes into it, so there is
  // nothing to add up and nothing to be turned away by.
  if (byThickness || !shot) {
    return {
      layers,
      effective: null,
      odds: null,
      outcome: "module",
      label: "",
      colour: NOT_ARMOUR,
    };
  }

  let total = 0;
  let ricochet = false;
  let armour = false;
  let overmatched = false;
  for (const layer of layers) {
    if (!layer.step) continue;
    if (layer.step.ricochet) {
      ricochet = true;
      break;
    }
    if (!layer.spaced) {
      // Only a plate of the vehicle itself settles the shot. A stack that is
      // nothing but screens has not reached anything to damage.
      armour = true;
      overmatched = layer.step.overmatch;
    }
    total += layer.step.effective;
  }

  const chance = ricochet || !armour ? null : oddsOf(shot.penetration, total);
  const screensOnly = !armour && layers.some((l) => l.spaced);
  const outcome = ricochet
    ? "ricochet"
    : screensOnly
      ? "screen"
      : !armour
        ? "module"
        : overmatched
          ? "overmatch"
          : "through";
  return {
    layers,
    effective: armour ? total : null,
    odds: chance,
    outcome,
    label: outcome === "through" ? "" : OUTCOME[outcome].label,
    colour: outcome === "through" ? onRamp(chance ?? 0) : OUTCOME[outcome].colour,
  };
}
