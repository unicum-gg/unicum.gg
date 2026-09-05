// What the client's own shader does that a standard material does not.
//
// Two passes over three's shader: the detail grain the client mixes into every
// surface, and the camouflage the customization system paints on top of it.
// Both are patched in rather than replaced, so a material keeps three's own
// lighting and only gains what the game adds to it.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";

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
 * Weave the detail layer into a standard material.
 *
 * three has no slot for this, so it is patched into the compiled shader: the
 * grain is sampled at the client's tiling and used to push roughness and albedo
 * by the amounts the client asks for, and nothing else about the material
 * changes.
 */
export function withDetail(material: THREE.MeshStandardMaterial, values: Record<string, unknown>) {
  const tiling = values?.g_detailUVTiling;
  const gloss = Number(values?.g_detailPowerGloss ?? 0);
  const albedo = Number(values?.g_detailPowerAlbedo ?? 0);
  if (!Array.isArray(tiling) || !(gloss > 0 || albedo > 0)) return material;
  material.userData.detail = {
    map: { value: GRAIN },
    tiling: { value: new THREE.Vector2(tiling[0] || 1, tiling[1] || 1) },
    gloss: { value: values.g_detailPowerGloss ?? 0 },
    albedo: { value: values.g_detailPowerAlbedo ?? 0 },
    // How far the layer carries, in metres. The client calls it
    // `g_detailPower` and gives 7 or 8 for a tank.
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
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#if defined( USE_NORMALMAP_TANGENTSPACE )
         ${rebuildZ}
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
         outgoingLight *= mix( 1.0, pow( bakedOcclusion, 0.7 ), 0.85 );
         #include <opaque_fragment>`,
      );
    }
    paintCamouflage(material, shader);

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
         float detail = (texture2D(detailMap, vMapUv * detailTiling).r - 0.5) * detailFade();
         roughnessFactor = clamp(roughnessFactor + detail * detailGloss, 0.04, 1.0);`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         diffuseColor.rgb *= 1.0 + (texture2D(detailMap, vMapUv * detailTiling).r - 0.5) * detailAlbedo * detailFade();`,
      );
  };
  return material;
}

