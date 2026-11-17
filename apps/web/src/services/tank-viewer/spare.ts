import type * as THREE from "three";
import type {
  GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";

import { modelsSpare } from "@unicum.gg/wargaming";

// Reading the mirror through whichever of its two hosts is answering.
//
// **The CDN is not ours and goes down as a whole.** The geometry is read
// through jsDelivr because GitHub serves raw files with five minutes of cache
// and one vehicle is eleven megabytes across thirty files, so the week a
// pinned commit earns there is what makes a second visit free. The cost showed
// up as a vehicle that sometimes did not appear: every cache miss on the CDN
// answered `503 No healthy backends`, on our repository and on `react@18.2.0`
// alike, while the files sat intact on GitHub and the reader got the flat
// render with nothing saying why.
//
// So a request the CDN refuses is asked again at the raw host, at the commit
// the address already names. Nothing here decides where the mirror is: the
// spare address is derived from the one that failed.

/**
 * Whether the CDN has already refused something this session.
 *
 * **The failure was not per file.** Every miss was refused while every hit was
 * served, so the first refusal says what the next thirty files will answer and
 * asking them anyway spends a round trip each to learn it again. Set once a
 * retry has worked, the rest of the session goes straight to the host that
 * answered. What that costs is GitHub's five minutes instead of a week, for
 * this one reader, which is the cheaper half of the trade by a long way.
 */
let refused = false;

/** The statuses that mean the CDN did not answer, rather than answered no. */
const shed = (status: number) => status === 429 || status >= 500;

/**
 * A mirror file, re-asked at the spare address where the CDN will not serve it.
 *
 * **A status is only retried where it is not an answer.** The viewer asks for
 * files that are legitimately absent, a vehicle's wardrobe patch and the style
 * catalogue of a mirror built before either existed, so a 404 is information
 * and asking the other host for it would double the cost of every one of them.
 * A 5xx, a 429 and a connection that never produced a response are the CDN
 * failing to answer at all.
 */
export async function grab(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const other = modelsSpare(url);
  if (!other) return fetch(url, init);
  if (refused) return fetch(other, init);
  try {
    const answer = await fetch(url, init);
    if (answer.ok || !shed(answer.status)) return answer;
  } catch {
    // A refusal the network never turned into a response at all.
  }
  const second = await fetch(other, init);
  if (second.ok) refused = true;
  return second;
}

/**
 * A piece of geometry, on the same terms as `grab`.
 *
 * three reports every failure alike, a refused request and a truncated file
 * together, so both are retried: the one outcome worth avoiding is a vehicle
 * standing on the page without its hull.
 */
export async function glb(loader: GLTFLoader, url: string): Promise<GLTF> {
  const other = modelsSpare(url);
  if (!other) return loader.loadAsync(url);
  if (refused) return loader.loadAsync(other);
  try {
    return await loader.loadAsync(url);
  } catch {
    const piece = await loader.loadAsync(other);
    refused = true;
    return piece;
  }
}

/**
 * A map, on the same terms, into the texture the caller is already holding.
 *
 * `TextureLoader.load` hands back a texture before its image exists and fills
 * it in later, which is what lets the material set its wrapping and its colour
 * space on the spot. So a retry cannot answer with a different texture: the
 * second attempt's image is moved onto the first, which is the object already
 * painted onto the vehicle.
 */
export function picture(
  textures: THREE.TextureLoader,
  url: string,
  settled: () => void,
): THREE.Texture {
  const other = modelsSpare(url);
  const map = textures.load(
    other && refused ? other : url,
    settled,
    undefined,
    () => {
      if (!other || refused) return settled();
      textures.load(
        other,
        (second) => {
          map.image = second.image;
          map.needsUpdate = true;
          refused = true;
          settled();
        },
        undefined,
        settled,
      );
    },
  );
  return map;
}
