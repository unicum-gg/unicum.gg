// The camouflage the customization system paints over the client's own shading.
//
// Its own file because it is by far the largest of the patches `compile` makes
// and it is the one with a shape of its own: four colours, two regions, a mask
// and an emission map, all read in the fragment stage against a projection the
// vertex stage computes. The others are a handful of lines each and read as
// what they are next to three's own includes.
//
// Patched rather than replaced, like the rest, so a material keeps three's
// lighting and only gains what the game adds to it.
import type * as THREE from "three";

/**
 * Paint the camouflage into a material's compiled shader.
 *
 * Does nothing where the material carries no camouflage, which is most of them:
 * the uniforms live on `userData` so a repaint can reach them without walking
 * the scene, and their absence is what says this surface takes none.
 */
export function paintCamouflage(
  material: THREE.MeshStandardMaterial,
  shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string },
): void {
  // The camouflage a player paints on.
  //
  // The pattern is not a picture: its four channels are **weights**, each
  // saying how much of one of the palette's four colours to lay down, and the
  // client authors them to sum to one. A colour's own alpha is its share, so
  // a palette that leaves one at zero means those areas keep the vehicle's own
  // paint rather than being painted a fourth colour. That is how a winter
  // camouflage puts white patches on a green tank instead of repainting it.
  //
  // Where it may go is the mask the client packs beside the occlusion, which
  // is what keeps paint off the tracks, the tools and the rubber.
  //
  // It is compiled in for every material that has a mask, painted or not, and
  // switched with `camoCover`. Making its presence a shader variant instead
  // would recompile the vehicle on every click for no gain.
  const camo = material.userData.camo;
  if (!camo) return;
  Object.assign(shader.uniforms, camo);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform sampler2D camoPattern;
         uniform vec4 camoColors[ 4 ];
         uniform vec4 camoRegionA;
         uniform vec4 camoRegionB;
         uniform vec4 camoRegionC;
         uniform vec4 camoRegionD;
         uniform vec4 camoTiling;
         uniform sampler2D camoIdMap;
         uniform float camoCover;
         uniform float camoTurn;
         uniform float camoBias;
         // **A camouflage is a coat of paint, so it has its own finish.** One
         // gloss and one metal per palette colour, blended by the same
         // weights as the colours, and a map that overrides both per pixel
         // where the camouflage ships one.
         // One gloss and one metal per painted region, indexed the same way
         // the colours are.
         uniform vec4 camoPaintGloss;
         uniform vec4 camoPaintMetal;
         uniform vec4 camoGlossSet;
         uniform vec4 camoMetalSet;
         uniform sampler2D camoGlossMetalMap;
         uniform float camoHasGlossMetal;
         uniform sampler2D camoNormalMap;
         uniform float camoNormalStrength;
         uniform sampler2D camoEmissionMap;
         uniform float camoEmissionPower;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         // Read again below, where three sets the roughness, the metalness and
         // the normal, so they are declared where all of them can see them.
         float camoOpacity = 0.0;
         float camoGloss = 0.0;
         float camoMetal = 0.0;
         float camoPaintOpacity = 0.0;
         float camoPaintGlossHere = 0.0;
         float camoPaintMetalHere = 0.0;
         vec2 camoUv = vec2( 0.0 );
         if ( camoCover > 0.0 ) {
           // Which of the piece's four regions this pixel belongs to. The
           // client's colour-id map holds them as four flat greys, and the
           // material's own bias shifts the read. **Clamped**, because a
           // region rounds to four wherever the map reaches white and a fifth
           // region does not exist: unclamped it fell off the end of the
           // paint and took the camouflage with it.
           float camoRegion = clamp( floor( texture2D( camoIdMap, vMapUv ).r * 4.0 + 0.5 + camoBias ), 0.0, 3.0 );
           vec4 camoPlain = camoRegionA;
           if ( camoRegion > 2.5 ) camoPlain = camoRegionD;
           else if ( camoRegion > 1.5 ) camoPlain = camoRegionC;
           else if ( camoRegion > 0.5 ) camoPlain = camoRegionB;

           // **The coverage is the occlusion map's red**, read at five times
           // its value the way the client scales it. It says how much of a
           // surface takes customization at all, and it is why a tow cable
           // and a set of tools keep their own look under a style that covers
           // the plates around them, and why a chassis, where it is flat
           // zero, never wears one at all.
           // Guarded, because three only declares the sampler and its UVs for
           // a material that has one, and a material without an occlusion map
           // is a material with nothing to hold customization back.
           #ifdef USE_AOMAP
             float camoRoom = min( texture2D( aoMap, vAoMapUv ).g * 5.0, 1.0 );
           #else
             float camoRoom = 1.0;
           #endif

           // **Paint multiplies the surface at twice its value**, so a mid
           // grey is neutral and the weld, the scratch and the streak the
           // texture holds all survive it. It is not held back by the
           // coverage: a paint the player chose covers the piece, and the
           // mask only governs the pattern laid over it.
           diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * camoPlain.rgb * 2.0, camoPlain.a );
           camoPaintOpacity = camoPlain.a;
           camoPaintGlossHere = camoRegion > 2.5 ? camoPaintGloss.w
                              : camoRegion > 1.5 ? camoPaintGloss.z
                              : camoRegion > 0.5 ? camoPaintGloss.y : camoPaintGloss.x;
           camoPaintMetalHere = camoRegion > 2.5 ? camoPaintMetal.w
                              : camoRegion > 1.5 ? camoPaintMetal.z
                              : camoRegion > 0.5 ? camoPaintMetal.y : camoPaintMetal.x;

           // The pattern is turned on the tiled coordinate, so the whole lay
           // turns rather than each tile. It is what runs a camouflage
           // diagonally across a hull instead of square to its UVs, and it is
           // carried by 1902 of the client's 3264 camouflages.
           float camoCos = cos( camoTurn );
           float camoSin = sin( camoTurn );
           camoUv = mat2( camoCos, camoSin, -camoSin, camoCos ) * ( vMapUv * camoTiling.xy + camoTiling.zw );
           vec4 camoWeight = texture2D( camoPattern, camoUv );
           camoWeight *= vec4( camoColors[ 0 ].a, camoColors[ 1 ].a, camoColors[ 2 ].a, camoColors[ 3 ].a );
           vec3 pattern = camoColors[ 0 ].rgb * camoWeight.x + camoColors[ 1 ].rgb * camoWeight.y
                        + camoColors[ 2 ].rgb * camoWeight.z + camoColors[ 3 ].rgb * camoWeight.w;
           float camoTotal = dot( camoWeight, vec4( 1.0 ) );
           // **The sum is the opacity, the average is the colour.** Dividing
           // separates the two: a palette that leaves a slot at zero drops
           // its share of the surface back to the paint underneath rather
           // than darkening the whole piece toward black, which is what a
           // plain weighted sum does to every winter camouflage.
           camoOpacity = min( camoTotal, 1.0 ) * camoRoom * camoCover;
           diffuseColor.rgb = mix( diffuseColor.rgb, pattern / max( camoTotal, 0.0001 ), camoOpacity );

           // The finish blends by the same weights as the colour, so a
           // pattern that puts a lacquered red beside a matt black gets both.
           camoGloss = dot( camoGlossSet, camoWeight ) / max( camoTotal, 0.0001 );
           camoMetal = dot( camoMetalSet, camoWeight ) / max( camoTotal, 0.0001 );
           if ( camoHasGlossMetal > 0.0 ) {
             // The mirror rewrites the client's gloss-metal into the layout
             // three samples, roughness in green and metal in blue, so this
             // reads the same channels a vehicle's own map is read on.
             vec3 camoSurface = texture2D( camoGlossMetalMap, camoUv ).rgb;
             camoGloss = 1.0 - camoSurface.g;
             camoMetal = camoSurface.b;
           }
         }`,
      )
      // Where the coat is laid it brings its own finish, so the vehicle's
      // roughness and metalness give way to it in proportion.
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         roughnessFactor = mix( roughnessFactor, 1.0 - camoPaintGlossHere, camoPaintOpacity );
         roughnessFactor = mix( roughnessFactor, 1.0 - camoGloss, camoOpacity );`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
         metalnessFactor = mix( metalnessFactor, camoPaintMetalHere, camoPaintOpacity );
         metalnessFactor = mix( metalnessFactor, camoMetal, camoOpacity );`,
      )
      // A relief of its own, on the 22 camouflages that carry one. Guarded on
      // the tangent frame, which three only builds for a material that has a
      // normal map of its own to put in it.
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
         #ifdef USE_NORMALMAP_TANGENTSPACE
           if ( camoNormalStrength > 0.0 && camoOpacity > 0.0 ) {
             vec3 camoRelief = texture2D( camoNormalMap, camoUv ).xyz * 2.0 - 1.0;
             float reliefCos = cos( camoTurn );
             float reliefSin = sin( camoTurn );
             camoRelief.xy = mat2( reliefCos, reliefSin, -reliefSin, reliefCos ) * camoRelief.xy * camoNormalStrength;
             normal = normalize( mix( normal, normalize( tbn * camoRelief ), camoOpacity ) );
           }
         #endif`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         if ( camoEmissionPower > 0.0 ) {
           totalEmissiveRadiance += texture2D( camoEmissionMap, camoUv ).rgb * camoEmissionPower * camoOpacity;
         }`,
      );
}
