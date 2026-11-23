// What the client's own shader does that a standard material does not.
//
// Two passes over three's shader: the detail grain the client mixes into every
// surface, and the camouflage the customization system paints on top of it.
// Both are patched in rather than replaced, so a material keeps three's own
// lighting and only gains what the game adds to it.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";

import type { Dressing } from "./dressing";
import { GRAIN, softRelief } from "./textures";
import { paintCamouflage } from "./shader-camouflage";

/**
 * The per-material uniforms the camouflage shader reads.
 *
 * They are held on the material's `userData` so a repaint can reach them
 * without walking the scene again, and they are declared here rather than
 * inferred so that adding one to the shader without setting it is a compile
 * error rather than a black sampler.
 */
export type CamoUniforms = {
  camoTurn: { value: number };
  camoPattern: { value: THREE.Texture };
  camoTiling: { value: THREE.Vector4 };
  camoColors: { value: THREE.Vector4[] };
  camoRegionA: { value: THREE.Vector4 };
  camoRegionB: { value: THREE.Vector4 };
  camoRegionC: { value: THREE.Vector4 };
  camoRegionD: { value: THREE.Vector4 };
  camoIdMap: { value: THREE.Texture };
  camoBias: { value: number };
  camoPaintGloss: { value: THREE.Vector4 };
  camoPaintMetal: { value: THREE.Vector4 };
  camoGlossSet: { value: THREE.Vector4 };
  camoMetalSet: { value: THREE.Vector4 };
  camoGlossMetalMap: { value: THREE.Texture };
  camoHasGlossMetal: { value: number };
  camoNormalMap: { value: THREE.Texture };
  camoNormalStrength: { value: number };
  camoEmissionMap: { value: THREE.Texture };
  camoEmissionPower: { value: number };
  camoCover: { value: number };
};

/**
 * A material that can take paint, with the part it belongs to.
 *
 * A style paints per part: a camouflage usually covers the hull, the turret and
 * the gun while a paint underneath it reaches the running gear too, so knowing
 * only that a material can be painted is not enough.
 */
export type PaintedMaterial = { uniforms: CamoUniforms; part: string; piece: string };

/**
 * Whether the vehicle's own texture coordinates are there to be read.
 *
 * **three declares `vMapUv` for the diffuse map and for nothing else**, so a
 * patch that samples at the material's own coordinates has none to sample at
 * unless the material carries one. It does not fail quietly: the identifier is
 * undeclared, the whole fragment shader fails to compile, and the piece is
 * never drawn. The T-34-85 arrived as a turret and two tracks floating over the
 * gap its hull should have filled.
 *
 * A material with no albedo is one the mirror carries none for, so there is
 * nothing for either layer to modulate in any case: it is drawn as it is.
 */
const readsUv = (material: THREE.MeshStandardMaterial) => material.map !== null;

/**
 * Weave the detail layer into a standard material.
 *
 * three has no slot for this, so it is patched into the compiled shader: the
 * grain is sampled at the client's tiling and used to push roughness and albedo
 * by the amounts the client asks for, and nothing else about the material
 * changes.
 */
export function withDetail(
  material: THREE.MeshStandardMaterial,
  values: Record<string, unknown>,
  /**
   * The client's own detail map, where the mirror carries it.
   *
   * **The grain below was only ever a stand-in.** When it was written the file
   * was in no package we could find, so the layer was rebuilt from a 256 pixel
   * procedural noise. The extraction brings the real one back now: 2048 square,
   * four channels, one file shared by every vehicle in the game. Its red
   * channel is the fine one, measured rather than assumed: six times its energy
   * is lost to a downsample where the alpha's is barely halved, which is the
   * difference between a micro-grain and the coarse mask beside it.
   */
  map?: THREE.Texture | null,
) {
  const tiling = values?.g_detailUVTiling;
  const gloss = Number(values?.g_detailPowerGloss ?? 0);
  const albedo = Number(values?.g_detailPowerAlbedo ?? 0);
  if (!Array.isArray(tiling) || !(gloss > 0 || albedo > 0)) return material;
  if (!readsUv(material)) return material;
  material.userData.detail = {
    map: { value: map ?? GRAIN },
    tiling: { value: new THREE.Vector2(tiling[0] || 1, tiling[1] || 1) },
    gloss: { value: values.g_detailPowerGloss ?? 0 },
    albedo: { value: values.g_detailPowerAlbedo ?? 0 },
    // How far the layer carries, in metres. The client calls it
    // `g_detailPower` and gives 7 or 8 for a tank.
    // **A close-up layer by nature, not by this number.** The hero frames a
    // vehicle from 19.8 m and this is 7, so at rest the layer contributes
    // nothing: only a reader who has zoomed in sees it at all. Carrying it to
    // 40 changes the framed picture by 0.89 levels of grey, measured, because
    // at that range one texel of a grain tiled four times across a panel is far
    // under a screen pixel and mipmapping averages it to flat. So the short
    // reach costs nothing and is left alone.
    reach: { value: values.g_detailPower || 8 },
  };
  return compile(material);
}

/**
 * The one shader patch, covering everything a client material asks for that
 * three does not do out of the box. There is a single slot for it, so both live
 * here rather than fighting over `onBeforeCompile`.
 *
 * **The normal map's third channel is rebuilt here**, because the mirror does
 * not ship one. The client keeps a normal in two channels and works the third
 * out in its own shader, since it is derivable, and the mirror follows: a
 * channel that carries nothing is a third more data and the one an encoder
 * mangles worst. Rebuilding also renormalises after filtering, which three's
 * default does not.
 *
 * **The detail grain** is the micro-relief every tank material names and no
 * client ships, weighted by the client's own `g_detailPower*` numbers.
 */
export function compile(material: THREE.MeshStandardMaterial) {
  // Where this vehicle stands between primer and its own paint, if it is being
  // dressed at all. Everything the dressing puts on fades up on this one value.
  const dressing = material.userData.dressing as Dressing | undefined;
  // **Every branch below has to be named in the cache key.**
  //
  // three compiles one program per material *configuration* and shares it
  // between every material that hashes the same. That hash is built from the
  // properties three knows about, and `onBeforeCompile` is not one of them, so
  // two materials that differ only in what this function injects are handed the
  // same program. The second one then runs the first one's shader against its
  // own uniforms, and any uniform the first added is simply missing: a sampler
  // reads black and a float reads zero.
  //
  // That is what hid a styled turret. The hull's material alpha-tests and got
  // the cut below, the turret's does not and reused the hull's program, so the
  // turret ran `texture2D( cutMask, uv ).b + cutBias <= cutAgainst` with all
  // three unbound, which is `0 + 0 <= 0`, and discarded every one of its
  // fragments. It drew all frame, cast its shadow, and put nothing on screen.
  //
  // `customProgramCacheKey` is the hook for exactly this, so it names each
  // branch here. Anything added to the patch has to be added to the key too.
  material.customProgramCacheKey = () =>
    [
      material.userData.cut ? "cut" : "nocut",
      material.userData.detail ? "grain" : "nograin",
      material.aoMap ? "ao" : "noao",
      material.userData.camo ? "camo" : "nocamo",
      dressing ? "dressing" : "nodressing",
    ].join("/");

  material.onBeforeCompile = (shader) => {
    // Rebuilding the normal's third channel, which the mirror does not ship.
    //
    // **Replace the include, not the line inside it.** `onBeforeCompile` hands
    // over three's own source with every `#include <...>` still unresolved, so a
    // patch aimed at a line that only exists after resolution silently matches
    // nothing. That is what happened here: the rebuild never ran, three read the
    // blue channel as z the whole time, and once the mirror started carrying the
    // client's alpha mask in blue a turret whose mask is zero got `z = -1` and
    // rendered as a black hole in the middle of the vehicle. A `.replace` that
    // finds nothing is silent, so anything patched this way has to be checked by
    // looking for the marker afterwards, not by reading the code and believing
    // it.
    //
    // Two readings of the same two channels, and they are not close. The exact
    // one solves for a unit vector, `z = sqrt(1 - x^2 - y^2)`, which is what the
    // encoding means. The soft one takes `(x, y, 1)`, normalises, halves the
    // slope and normalises again, which is how a Blender import at strength 0.5
    // reads it. `?relief=soft` picks that reading.
    const rebuildZ = softRelief()
      ? `vec3 mapN = normalize( vec3( texture2D( normalMap, vNormalMapUv ).xy * 2.0 - 1.0, 1.0 ) );
         mapN = normalize( vec3( mapN.xy * 0.5, mapN.z ) );`
      : `vec3 mapN = vec3( texture2D( normalMap, vNormalMapUv ).xy * 2.0 - 1.0, 0.0 );
         mapN.z = sqrt( max( 0.0, 1.0 - dot( mapN.xy, mapN.xy ) ) );`;
    // Flat until the vehicle is dressed, for the same reason its plates are one
    // colour: relief arriving before the paint is a second change to watch.
    const raised = dressing ? "mapN = mix( vec3( 0.0, 0.0, 1.0 ), mapN, dressed );" : "";
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#if defined( USE_NORMALMAP_TANGENTSPACE )
         ${rebuildZ}
         ${raised}
         mapN.xy *= normalScale;
         normal = normalize( tbn * mapN );
       #else
         #include <normal_fragment_maps>
       #endif`,
    );

    // Nothing on a tank is a mirror.
    //
    // A perfectly smooth surface concentrates the whole environment into a
    // point, which on a vehicle shows up as a hard white speck that crawls over
    // a plate as the camera moves. The client's own floor is 0.04 and it is
    // there for the same reason.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
       roughnessFactor = max( roughnessFactor, 0.04 );`,
    );

    // The cut, made where the client makes it.
    //
    // A BigWorld material that alpha-tests compares the **normal map's own mask
    // channel** plus `g_maskBias` against `alphaReference`, and discards below
    // it. That is what opens the gaps in a track and the holes in a grille. We
    // had been handing three the diffuse map's alpha, which is a different
    // channel of a different file and only ever right by coincidence. The mirror
    // carries the mask in the normal map's blue, so it costs no extra lookup.
    if (material.userData.cut) {
      const cut = material.userData.cut;
      shader.uniforms.cutMask = { value: material.normalMap };
      shader.uniforms.cutBias = { value: cut.bias };
      shader.uniforms.cutAgainst = { value: cut.against };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform sampler2D cutMask;
           uniform float cutBias;
           uniform float cutAgainst;`,
        )
        .replace(
          "#include <alphatest_fragment>",
          `if ( texture2D( cutMask, vNormalMapUv ).b + cutBias <= cutAgainst ) discard;`,
        );
    }

    // The occlusion the client bakes is applied to **all** the light, not just
    // the ambient.
    //
    // three's own `aoMap` only attenuates indirect light, which is right for a
    // physically-argued renderer and wrong for this vehicle: the map is not a
    // subtle crease darkener but the shading itself, averaging 0.40 on a hull
    // and 0.25 on a turret, black in the engine grilles and under every fender.
    // Left on the ambient alone it does almost nothing, and the tank comes out
    // as a pale shell with no depth in it. The game leans on it, which is why
    // its running gear and its deck read as recesses rather than as paint.
    if (material.aoMap) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `float bakedOcclusion = texture2D( aoMap, vAoMapUv ).r;
         // Softened, or the deepest parts of the map go to pure black: it was
         // baked to sit under the game's own ambient, not to replace lighting.
         outgoingLight *= mix( 1.0, pow( bakedOcclusion, 0.7 ), ${dressing ? "0.85 * dressed" : "0.85"} );
         #include <opaque_fragment>`,
      );
    }
    if (readsUv(material)) paintCamouflage(material, shader);

    // **Last, because everything else writes this colour.** The map, the
    // camouflage and the grain all compose `diffuseColor`, and the fade has to
    // sit after all three or it would be painted over by whichever ran later.
    // `lights_physical_fragment` is where the colour is read rather than
    // written, and nothing else here patches it.
    if (dressing) {
      shader.uniforms.dressed = dressing.worn;
      shader.uniforms.here = dressing.here;
      shader.uniforms.primer = { value: dressing.primer };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float dressed;
           uniform float here;
           uniform vec3 primer;`,
        )
        .replace(
          "#include <lights_physical_fragment>",
          `diffuseColor.rgb = mix( primer, diffuseColor.rgb, dressed );
           #include <lights_physical_fragment>`,
        )
        // **Arriving is a discard, not an opacity.** The room is on screen
        // before the vehicle is, so the vehicle has to come into it, and the
        // obvious way is to turn a material transparent and raise its alpha.
        // That one asks the renderer to sort a hundred thousand triangles of a
        // tank against each other, which it cannot do: the far side of a hull
        // draws over the near side and the belt shows through its own guards.
        // Dropping fragments by their position on screen instead costs no
        // sorting and no second pass and leaves depth correct at every stage.
        // The threshold is of the pixel rather than of the frame, so a
        // fragment that is in stays in: pixels arrive one after another
        // instead of flickering.
        //
        // **Ordered, not random.** A hash was tried first and it moutonne:
        // random values clump, so a half-arrived hull comes up in blotches
        // the size of the clumps. A Bayer threshold spreads the same number of
        // pixels evenly over every four by four, which at a device pixel is
        // under anything an eye resolves and reads as a tone rather than as
        // grain.
        //
        // First in the shader, before anything is sampled: a fragment that is
        // not going to be drawn should not be paid for.
        .replace(
          "#include <common>",
          `#include <common>
           // The 4x4 ordered threshold, built rather than tabulated: two 2x2
           // patterns, the finer one at a quarter weight inside the coarser.
           float coarse( vec2 at ) {
             at = floor( at );
             return fract( at.x * 0.5 + at.y * at.y * 0.75 );
           }
           float ordered( vec2 at ) {
             return coarse( at * 0.5 ) * 0.25 + coarse( at );
           }`,
        )
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
           // **At or above, not above.** One cell of the sixteen holds zero,
           // so a strict comparison draws a sixteenth of the vehicle before it
           // has begun arriving: a stipple of it, blocking the grid behind.
           if ( here < 1.0 && ordered( gl_FragCoord.xy ) >= here ) discard;`,
        )
        // **And it comes up out of the dark as it fills in.** Half the pixels
        // of a half-arrived vehicle is a speckle, and a speckle at full
        // brightness over a dark floor is exactly as loud as it sounds. Dimmed
        // by the same value, the noisiest moment is also the faintest, and
        // what a reader sees is a shape gathering rather than a sieve.
        .replace(
          "#include <opaque_fragment>",
          `outgoingLight *= here;
           #include <opaque_fragment>`,
        );
    }

    const detail = material.userData.detail;
    if (!detail) return;
    Object.assign(shader.uniforms, {
      detailMap: detail.map,
      detailTiling: detail.tiling,
      detailGloss: detail.gloss,
      detailAlbedo: detail.albedo,
      detailReach: detail.reach,
    });
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform sampler2D detailMap;
         uniform vec2 detailTiling;
         uniform float detailGloss;
         uniform float detailAlbedo;
         uniform float detailReach;
         // The layer is a surface finish, not a pattern: it belongs at arm's
         // length and nowhere else. Held back by distance it reads as metal up
         // close and disappears before it can turn a hull into sandpaper, which
         // is what a grain tiled eight times across a panel does when a viewer
         // draws it at every range alike.
         float detailFade() {
           float away = length(vViewPosition) / max(detailReach, 0.001);
           return clamp(1.0 - away * away, 0.0, 1.0);
         }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         float detail = (texture2D(detailMap, vMapUv * detailTiling).a - 0.5) * detailFade();
         roughnessFactor = clamp(roughnessFactor + detail * detailGloss, 0.04, 1.0);`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         diffuseColor.rgb *= 1.0 + (texture2D(detailMap, vMapUv * detailTiling).a - 0.5) * detailAlbedo * detailFade();`,
      );
  };
  return material;
}

