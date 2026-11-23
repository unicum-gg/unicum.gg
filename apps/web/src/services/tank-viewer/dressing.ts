import * as THREE from "three";

import type { MirrorTexture } from "@unicum.gg/wargaming";
import { SHADOW_STRENGTH } from "./lighting";

// How a vehicle comes up: it arrives, and then it is dressed.
//
// A material is built once and dressed afterwards, and the two happen seconds
// apart: its meshes are in the browser long before its three megabytes of
// paint. So the slots that only dress a surface are filled with a stand-in,
// filed here with the map they are owed, and taken off together once those have
// landed. The shop still owns the textures and the paths, this owns the queue
// and the moment.

/** The slots a vehicle is dressed in, all of which can wait for their map. */
export type Dressed = "map" | "normalMap" | "aoMap" | "roughnessMap" | "metalnessMap";

/**
 * What a slot wears until its own map is asked for, or nothing where the
 * material names no map for it: an empty slot stays empty.
 */
export const until = (entry: MirrorTexture | undefined, worn: THREE.Texture) =>
  entry ? worn : null;

/** A map on its way, and the arrival whoever put a stand-in in its slot waits for. */
type Coming = { map: THREE.Texture; coming: Promise<void> | undefined };

/**
 * How long the paint takes to go on, once it is all there.
 *
 * Short enough to read as one change rather than as a stage of the loading,
 * long enough that nothing snaps.
 */
const PAINTING = 600;

/**
 * How long the vehicle takes to arrive in a room that is already standing.
 *
 * Shorter than the paint that follows it: this one is a shape appearing, which
 * is read at once, where that one is a surface changing under a shape already
 * being looked at.
 */
const ARRIVING = 320;

/**
 * What the shader is told, so a vehicle can be shown between the two states.
 *
 * **The maps are swapped in one assignment and there is no second sampler.** A
 * cross-fade between two textures needs both bound at once, which is a second
 * lookup in every slot for the second and a half it is used. The stand-ins are
 * flat colours, though, so the state being faded FROM is a constant: the
 * shader mixes towards it and the whole change costs one float and one colour.
 */
export type Dressing = {
  /**
   * Whether the vehicle is there at all, 0 to 1.
   *
   * **It opens at nothing and the room opens at everything**, which is the
   * whole point of the pair: the studio is on screen while the meshes are
   * still being fetched, so a vehicle that is half assembled must not be
   * drawn into it. Every fragment of it is discarded until this moves, and
   * what moves it is the vehicle being finished.
   */
  here: { value: number };
  /** How far it is between primer and its own paint, 0 to 1. */
  worn: { value: number };
  /** The colour the paint is mixed out of, which is what it stood in. */
  primer: THREE.Color;
};

/**
 * Open the state for one vehicle, reading the colour it starts from off the
 * stand-in itself rather than writing that grey down a second time: the two
 * have to agree, or the fade begins somewhere the vehicle was never standing.
 */
export function dressingFrom(standIn: THREE.DataTexture): Dressing {
  const bare = standIn.image.data as Uint8Array;
  const at = (i: number) => (bare[i] ?? 0) / 255;
  return {
    here: { value: 0 },
    worn: { value: 0 },
    primer: new THREE.Color().setRGB(at(0), at(1), at(2), THREE.SRGBColorSpace),
  };
}

/** Ease the two ends, so nothing here starts or stops abruptly. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Bring a vehicle from primer to its own paint, over `PAINTING`.
 *
 * The loop only draws what has changed, so whoever asks for this has to keep
 * it awake: the fade is a uniform moving under a picture that is otherwise
 * finished, and nothing else would ask for another frame.
 */
/**
 * The most a single frame may advance an animation, in milliseconds.
 *
 * Anything longer than this was a stall rather than a frame, and a stall is
 * not time a reader spent watching: counted as elapsed, it is skipped past.
 */
const LONGEST_FRAME = 120;

/**
 * Move a value from 0 to 1 over `over` of drawn frames, eased at both ends.
 *
 * **Counted in frames the browser drew, not on the clock.** The moment a
 * vehicle is finished is the busiest the page ever gets: the panels mount,
 * which is a React render of the whole hero, and nothing paints until it is
 * over. On the clock the whole of a short animation fell inside that stall,
 * so the first frame drawn after it was already the last one: measured, the
 * tank arrived in a single frame, which is the one thing this exists to
 * avoid. What is accumulated here is the time between frames that happened,
 * each capped, so an animation is as long as it looks however badly the
 * thread behaves.
 */
function ramp(
  over: number,
  onto: (t: number) => void,
  /** Held open while this runs: the loop paints only what has changed. */
  awake?: (ms: number) => void,
): Promise<void> {
  return new Promise((done) => {
    let last: number | null = null;
    let shown = 0;
    const step = (now: number) => {
      // Held open on every frame rather than once at the start: an animation
      // counted in frames outlasts its own duration whenever the thread
      // stalls, and a window set at the beginning would close under it.
      awake?.(over);
      if (last !== null) shown += Math.min(now - last, LONGEST_FRAME);
      last = now;
      const t = Math.min(1, shown / over);
      onto(smooth(t));
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}

/**
 * Bring the vehicle into the room, and the shadow it casts with it.
 *
 * The shadow is ramped here rather than in the shader because it is drawn by
 * a material three substitutes for ours, so the patch that dissolves the
 * vehicle cannot reach it: left alone it lands whole, under a tank that is
 * still arriving.
 */
export function arrive(
  dressing: Dressing,
  ground: THREE.Mesh | null,
  awake?: (ms: number) => void,
): Promise<void> {
  const shade = ground?.material;
  const casts = shade instanceof THREE.ShadowMaterial ? shade : null;
  if (casts) casts.opacity = 0;
  return ramp(
    ARRIVING,
    (t) => {
      dressing.here.value = t;
      if (casts) casts.opacity = SHADOW_STRENGTH * t;
    },
    awake,
  );
}

/**
 * Open a rack for one vehicle: what each of its materials is still owed.
 *
 * `ask` is how a map is fetched, which is the shop's business: it knows the
 * paths, which of the two definitions is being read, and which files are
 * already in hand.
 */
export function dressingRack(
  ask: (entry: MirrorTexture) => Coming,
  /** Where the vehicle stands between primer and paint, shared by its shop. */
  { worn }: Dressing,
) {
  /**
   * Every slot wearing a stand-in, and which of the mirror's maps it is owed.
   *
   * **Put on together, never one at a time.** Showing a vehicle before its
   * maps was tried and rejected once, and what made it wrong was not the bare
   * surface but the sequence: the hull turned white, the tracks black, and the
   * paint arrived a piece at a time, so the picture read as something being
   * assembled rather than something being looked at. Held as a list and
   * applied in one pass, a vehicle stands in primer and then is painted, which
   * is two states and one change.
   *
   * **It holds the entry rather than a texture already in flight**, and that
   * is the half that decides when the vehicle stands rather than how it looks.
   * Asked for with the material, a dressing map is on the wire while the cut
   * masks the first frame really does wait for are still queued behind it, and
   * the reveal lands with the last of three megabytes instead of with the
   * first hundred kilobytes: measured, deferring the WAIT alone bought nothing
   * at all. So nothing here is fetched until `dress` asks for it.
   */
  const owed: {
    built: THREE.MeshStandardMaterial;
    slot: Dressed;
    entry: MirrorTexture;
  }[] = [];

  return {
    /** Whether anything is still standing in primer, waiting to be dressed. */
    get owing(): boolean {
      return owed.length > 0;
    },
    /** File every slot a material is dressed in, with the map it is owed. */
    owes(
      built: THREE.MeshStandardMaterial,
      maps: Record<string, MirrorTexture>,
      /** The slots it was built with, which are already wearing the real map. */
      builtWith: readonly Dressed[],
    ): void {
      const file = (slot: Dressed, entry: MirrorTexture | undefined) => {
        if (entry && !builtWith.includes(slot)) owed.push({ built, slot, entry });
      };
      file("map", maps.diffuseMap);
      file("normalMap", maps.normalMap);
      file("aoMap", maps.excludeMaskAndAOMap);
      file("roughnessMap", maps.metallicGlossMap);
      file("metalnessMap", maps.metallicGlossMap);
    },
    /**
     * Ask for every map that is owed, then put them all on once they are there.
     *
     * Called where the vehicle is already standing, so the wait costs the
     * reader nothing: they are looking at a tank in primer rather than at an
     * empty studio. The maps are bound in one pass and then faded up together,
     * so what a reader sees is one change and not twenty.
     *
     * `awake` holds the draw loop open for the fade, since a uniform moving
     * under a finished picture is not something the loop can notice on its own.
     *
     * A map that failed keeps its stand-in rather than being put on empty,
     * which is the rule the rest of the viewer follows: an unbound sampler
     * reads black, and a plate missing its paint is better than a plate that
     * has gone dark. Failures settle like arrivals, so one missing file delays
     * the others and never strands them.
     */
    async dress(awake?: (ms: number) => void): Promise<void> {
      const going = owed.splice(0, owed.length);
      if (!going.length) return;
      const coming = going.map((o) => ({ ...o, ...ask(o.entry) }));
      await Promise.all(coming.map((o) => o.coming ?? Promise.resolve()));
      for (const { built, slot, map } of coming)
        if (map.image?.width) built[slot] = map;
      // Already dressed, which is the sharp set landing on a vehicle that has
      // been standing in its paint for a while: there is nothing to fade from.
      if (worn.value >= 1) return;
      await ramp(
        PAINTING,
        (t) => {
          worn.value = t;
        },
        awake,
      );
    },
  };
}
