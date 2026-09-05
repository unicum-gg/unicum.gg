// The textures the viewer makes rather than loads.
//
// The client mixes a detail grain into every surface and leaves several
// samplers unbound; both are answered here, because an unbound sampler reads
// black and a shader that samples one is not obviously broken until something
// disappears.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";
import { switched } from "./switches";

/** `?relief=soft` softens the client's detail relief, which is how it is
 * compared against captures of the game. */
export const softRelief = () => switched("relief") === "soft";

/**
 * The micro-detail every tank material asks for and no client ships.
 *
 * Each material names `Tank_detail/Details_map.dds` and carries the settings
 * that drive it: `g_detailUVTiling` (about eight repeats across the piece),
 * `g_detailPowerAlbedo` (0.10 to 0.14), `g_detailPowerGloss` (0.35) and
 * `g_detailPower` (7 to 8). The file itself is in no package: searched across
 * every shared and sandbox package in all three parts, `Tank_detail` holds only
 * the dirt and snow maps. So the layer is rebuilt rather than mirrored: a fine
 * neutral grain, tiled and weighted by the client's own numbers.
 *
 * **It has to be genuinely fine.** The first version mixed a fine speckle with
 * a slow sine swirl, two thirds of its weight on the swirl. Measured on the
 * texture, that put more energy 48 pixels apart than 1 pixel apart, and at the
 * client's own tiling those became palm-sized blotches drifting across a
 * glacis: not micro-detail, dirt. A cast-metal grain is almost all of its
 * energy at one texel.
 *
 * It matters more than it sounds. Gloss is modulated by 0.35, and on a large,
 * gently curved, fairly smooth shell it is that variation that makes a
 * reflection break up instead of sliding across as one clean sheet. Without it
 * a hull reads as plastic no matter how good the albedo is.
 */
export function detailGrain() {
  const side = 256;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(side, side);

  // White noise, softened by one pixel so it survives mipmapping instead of
  // dissolving into a flat grey the moment the surface tilts away.
  const noise = new Float32Array(side * side);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.random();
  const soft = new Float32Array(side * side);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += noise[((y + dy + side) % side) * side + ((x + dx + side) % side)];
        }
      }
      soft[y * side + x] = sum / 9;
    }
  }

  // Centred on zero and scaled to a fixed spread, so the layer only ever adds
  // texture. The shader reads this as `value - 0.5`, so a mean that drifts off
  // 0.5 quietly lifts or drops the albedo and the roughness of every material
  // it touches.
  let mean = 0;
  for (const v of soft) mean += v;
  mean /= soft.length;
  let spread = 0;
  for (const v of soft) spread += (v - mean) ** 2;
  spread = Math.sqrt(spread / soft.length);
  const scale = 0.12 / (spread || 1);

  for (let i = 0; i < soft.length; i++) {
    const v = Math.round(255 * Math.min(1, Math.max(0, 0.5 + (soft[i] - mean) * scale)));
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  // Tiled eight times across a panel and read at grazing angles, so it needs
  // the same anisotropy the vehicle's own maps get or it smears to grey exactly
  // where a viewer is closest to the metal.
  map.anisotropy = 16;
  return map;
}

/** One grain for the whole vehicle, the way one file would have been. */
export const GRAIN = detailGrain();

/**
 * One black pixel, for a sampler that has nothing to read yet.
 *
 * Leaving a sampler unbound is not harmless: it reads black, and a shader that
 * quietly samples nothing looks exactly like one that works until the thing it
 * was meant to draw goes missing.
 */
/**
 * A one-pixel texture, ready to sample.
 *
 * three filters a texture through its mipmaps by default, and a texture made by
 * hand has none, so a sampler set up that way reads nothing at all. Which looks
 * exactly like a shader that decided not to draw.
 */
export function flat<T extends THREE.Texture>(map: T): T {
  map.minFilter = THREE.NearestFilter;
  map.magFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  return map;
}

export const BLANK = flat(new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1));
// A normal map's own idea of "no relief", which is not black: an unbound
// sampler reads zero and decodes to a normal pointing back into the surface.
export const FLAT = flat(new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1));


/** How long a texture has to arrive before it is treated as one that will not. */
const PATIENCE = 10000;

/**
 * Wait for a texture's picture, since nothing can be sized against it before.
 *
 * `TextureLoader.load` hands back a texture whose image is still null and fills
 * it in later, so a decal built straight away would be sized against nothing.
 */
export function whenLoaded(map: THREE.Texture): Promise<THREE.Texture> {
  if (map.image?.width) return Promise.resolve(map);
  return new Promise((done) => {
    // **It gives up, because a texture can simply never arrive.** A failed load
    // is a normal outcome here, the loader routes it to the same callback as a
    // successful one, and it leaves the image null forever. Waiting on that
    // without a limit is a timer for the life of the page and a promise that
    // never settles, which strands whatever asked: a mark or a style whose old
    // decals have already been stripped and whose new ones never come.
    //
    // Resolved rather than rejected: the caller wants a texture to measure, and
    // one with no picture measures as nothing, which is what a missing decal
    // should be.
    const gave = setTimeout(() => {
      clearInterval(wait);
      done(map);
    }, PATIENCE);
    const wait = setInterval(() => {
      if (!map.image?.width) return;
      clearInterval(wait);
      clearTimeout(gave);
      done(map);
    }, 40);
  });
}

