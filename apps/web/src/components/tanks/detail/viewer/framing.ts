import type * as Three from "three";
import type { OrbitControls as Controls } from "three/examples/jsm/controls/OrbitControls.js";

// Where the camera stands, and what it is aiming at.
//
// The angle and the distance the hero is framed at, kept apart from everything
// that moves the camera because they are not choices the viewer makes: they are
// measured against the picture the 3D one replaced, so that a reader who knew
// the old hero sees the same tank at the same size in the same place.

/**
 * How the picture this replaces was framed, fitted rather than guessed.
 *
 * WG's portal renders are all shot from one camera and none of its numbers are
 * published. They were recovered by driving this viewer through a sweep of
 * angles and distances and comparing the silhouette it draws against a real
 * render's: how tall the outline is for its width, and how much of its own box
 * it fills, pin the angle down to about a percent. Twenty degrees round and
 * twenty-six up, at a distance matching the width to within one percent.
 *
 * The anchor is where the model has to land afterwards, in fractions of the
 * canvas. It is deliberately not WG's published centroid: that measures a centre
 * of mass and this measures an outline, so the two do not coincide, and what
 * matters is only that the model sits where the picture sat.
 *
 * **Moving it a hundredth moves the vehicle two.** The offset is given as a
 * fraction of the frame and read as one of the half-frame either side of centre,
 * so a correction applied at face value overshoots by exactly double, which is
 * how the first attempt turned an error of three points below into three above.
 */
export const AZIMUTH = (20 * Math.PI) / 180;
export const ELEVATION = (26 * Math.PI) / 180;
/**
 * How far back the camera stands, in metres, and the same for every vehicle.
 *
 * **The picture this replaces does not fit the frame to the tank, and neither
 * can this.** Framing each vehicle to fill the band is the obvious thing to do
 * and it is what a first pass did, but it makes a scout as big as a heavy, and
 * the render underneath keeps them at their real sizes. Measured against WG's
 * own renders, the framing distance they imply holds steady while a fitted one
 * would not: 20.6 for the IS-7, 20.0 for the Object 140 and 21.9 for the T-70,
 * whose own fitted distances run from 8.9 to 19.6. A fitted camera had the T-70
 * two and a half times too big.
 *
 * So the vehicles differ in size on screen, as they do in the game, and a Maus
 * fills the hero while a light sits inside it.
 */
export const DISTANCE = 19.8;
/** How long the outgoing view takes to dissolve, in milliseconds. */
export const VIEW_DISSOLVE = 180;

export const ANCHOR_X = 0.395;
export const ANCHOR_Y = 0.4484;

/**
 * The hero band's proportions on a wide screen (`HERO_BAND`), which is what the
 * frame a vehicle has to fit in is measured against.
 */
const HERO_ASPECT = 32 / 15;
/**
 * How far from the middle of the frame, in normalised device coordinates, a
 * vehicle may reach before the camera backs off. Measured, so that no vehicle a
 * player drives ever trips it: up and down is what binds, and the tallest in
 * the frame, the Type 5 Heavy, reaches 1.03 (the IS-7 and the Maus 0.96, the
 * T-70 0.45), its widest 0.39. Past the edge on purpose: the hero offsets the
 * frame and the title sits over the top, so a big tank already runs under both.
 */
const REACH_ACROSS = 0.62;
const REACH_UP = 1.1;
/**
 * The frame a vehicle that tripped those is backed off into, tighter on
 * purpose. The reach above is a tripwire placed past every playable vehicle,
 * edges included; a boss has no render to agree with, so once the camera moves
 * for it, it is given the whole of it clear of the edges and the title.
 */
const FIT_ACROSS = 0.6;
const FIT_UP = 0.95;

/**
 * How far back the camera has to stand to hold this vehicle, and what it aims
 * at from there. Never closer than `DISTANCE`, and for every vehicle that fits
 * at it, the target it was given.
 *
 * **A floor, not a fit.** Every vehicle a player drives is framed at `DISTANCE`
 * for the reasons given there, and this leaves each of them exactly where it
 * was. What it catches is a vehicle no frame at that distance can hold: an
 * event's boss is built on another scale (the Halloween spider stands on legs
 * twenty metres across), and at the shared distance it overflowed the hero on
 * every side. Those have no render of WG's to line up with, so backing off
 * costs them nothing, and neither does aiming at the middle of what is drawn
 * rather than at the target the caller measured, which is taken off a box that
 * counts what the vehicle hides.
 *
 * **Measured on the vertices, not on a box.** The corners of a bounding box
 * are mostly empty space, and the camera looks down on the vehicle: the corner
 * under the muzzle of a long gun sits at ground level two barrels ahead of the
 * hull, and projected it put an IS-7 half again outside a frame it fills
 * comfortably. Only what is drawn counts, as it is posed, since a material can
 * hide a mesh (the spider's treads) and a skinned mesh's own box is its rest
 * pose.
 *
 * A perspective projection shrinks as the inverse of the distance, so scaling
 * by the overshoot converges in a step or two.
 */
export function standOff(
  THREE: typeof import("three"),
  vehicle: import("three").Object3D,
  target: import("three").Vector3,
  towards: import("three").Vector3,
  fov: number,
): { distance: number; target: import("three").Vector3 } {
  vehicle.updateMatrixWorld(true);
  const points: number[] = [];
  const drawn = new THREE.Box3();
  const v = new THREE.Vector3();
  vehicle.traverseVisible((o) => {
    const mesh = o as import("three").Mesh;
    const position = mesh.isMesh ? mesh.geometry.getAttribute("position") : null;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
      points.push(v.x, v.y, v.z);
      drawn.expandByPoint(v);
    }
  });
  const camera = new THREE.PerspectiveCamera(fov, HERO_ASPECT, 0.1, 1000);
  const overshootFrom = (
    aim: import("three").Vector3,
    distance: number,
    across: number,
    up: number,
  ) => {
    camera.position.copy(aim).addScaledVector(towards, distance);
    camera.lookAt(aim);
    camera.updateMatrixWorld();
    let overshoot = 1;
    for (let i = 0; i < points.length; i += 3) {
      v.set(points[i], points[i + 1], points[i + 2]).project(camera);
      overshoot = Math.max(
        overshoot,
        Math.abs(v.x) / across,
        Math.abs(v.y) / up,
      );
    }
    return overshoot;
  };
  if (points.length === 0 || overshootFrom(target, DISTANCE, REACH_ACROSS, REACH_UP) <= 1) {
    return { distance: DISTANCE, target };
  }
  const aim = drawn.getCenter(new THREE.Vector3());
  let distance = DISTANCE;
  for (let pass = 0; pass < 4; pass++) {
    const overshoot = overshootFrom(aim, distance, FIT_ACROSS, FIT_UP);
    if (overshoot <= 1.001) break;
    distance *= overshoot;
  }
  return { distance, target: aim };
}

/**
 * How high the camera looks when there is no vehicle to measure, in metres.
 *
 * The rig aims at the middle of the one it has, which runs from about a metre
 * on a scout to a metre and a half on a Maus. This is the middle of that, and
 * it is only ever on screen for the second or two before the meshes land.
 */
const EMPTY_STAGE_EYE = 1.25;

/**
 * Point the camera at an empty stage, before there is a vehicle to measure.
 *
 * **The distance and the angles are not fitted to the vehicle**, which is what
 * makes this possible at all: they are the constants above, so the only thing
 * the vehicle decides is how high the camera looks, and the rig corrects that
 * when the meshes land. Left where it was created, at the origin, the camera
 * draws the studio from inside its own floor.
 *
 * **Where a vehicle is being taken over from, that camera wins outright.** The
 * guess above is a height, and a height is the one thing the floor reads: the
 * grid is at zero and the camera is not, so a room drawn from 1.25 and a room
 * drawn from the last vehicle's own middle put their floor in two different
 * places. The frame of the outgoing vehicle is held over the band while this
 * one is built, so those two floors are on screen at once and slide against
 * each other as the sheet dissolves. The rig puts the camera back there
 * anyway once the meshes land, so this is the same decision taken early
 * enough to be true of the first frame rather than of the tenth.
 */
export function standCamera(
  camera: Three.PerspectiveCamera,
  controls: Controls,
  /** Where the vehicle being taken over from was last seen, where there is one. */
  from?: { position: number[]; target: number[] } | null,
): void {
  if (from) {
    camera.position.fromArray(from.position);
    controls.target.fromArray(from.target);
    controls.update();
    return;
  }
  camera.position.set(
    Math.cos(ELEVATION) * Math.sin(AZIMUTH) * DISTANCE,
    EMPTY_STAGE_EYE + Math.sin(ELEVATION) * DISTANCE,
    Math.cos(ELEVATION) * Math.cos(AZIMUTH) * DISTANCE,
  );
  controls.target.set(0, EMPTY_STAGE_EYE, 0);
  controls.update();
}
