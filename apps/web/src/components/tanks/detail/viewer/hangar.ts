import type * as THREE from "three";

import { readPalette } from "@/services/tank-viewer/palette";

// The room the vehicle stands in.
//
// A floor and a grid, and nothing else: it exists so the tank has a ground to
// cast a shadow on and a scale to be read against, and so two vehicles shown
// one after the other stand in the same place. Its own file because none of it
// depends on which tank is being drawn, which is the rest of the build.

/** Build the hangar floor, in the colours the page is already using. */
export function hangar(
  THREE: typeof import("three"),
  scene: THREE.Object3D,
  surface: HTMLElement,
): void {
  const paint = readPalette({ rule: "--muted-foreground" }, surface) ?? {
    rule: 0x818181,
  };
  const floor = new THREE.Group();
  // **The grid is drawn, not strung.** A `GridHelper` is GL lines, and a GL
  // line is one pixel wide on every platform that matters: `linewidth` is in
  // the material and does nothing, so a grid made of them can only ever be
  // as thin as the hardware draws. Put in the floor's own shader it has a
  // width in metres, it is antialiased against its own derivative rather
  // than against nothing, and it fades out with the disc it sits on instead
  // of running to an edge of its own.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(26, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      // **Drawn on both faces, because it is the floor's only mark.** While
      // the grid was lines it read from either side for free; as a disc it
      // is one-sided by default, so opening the orbit under the vehicle
      // showed nothing at all down there.
      side: THREE.DoubleSide,
      // **Writing depth here is what broke the shadow.** The grid and the
      // plane that catches the vehicle's shadow are both at the floor, so a
      // disc that writes depth fights the catcher for the same pixels and
      // the shadow comes back in blocks. It went unseen while the disc was
      // painted nearly opaque, which covered the mess it was making.
      //
      // A transparent overlay has no business writing depth in any case:
      // there is nothing behind it that it should hide.
      depthWrite: false,
      uniforms: {
        rule: {
          value: new THREE.Color().setHex(paint.rule, THREE.SRGBColorSpace),
        },
      },
      vertexShader:
        "varying vec2 vXy; void main() { vXy = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        uniform vec3 rule;
        varying vec2 vXy;

        // How much of this pixel a line of \`weight\` metres covers, at
        // \`step\` metres apart. Measured against the derivative so a line
        // holds its width on screen as the floor runs away from the camera,
        // rather than aliasing into a stipple at the far end.
        float rules(vec2 at, float step, float weight) {
          vec2 grid = abs(fract(at / step - 0.5) - 0.5) * step;
          vec2 soft = fwidth(at) * 0.5;
          vec2 line = 1.0 - smoothstep(vec2(0.0), soft + weight * 0.5, grid);
          return max(line.x, line.y);
        }

        void main() {
          float away = length(vXy) / 26.0;
          // Brightest under the vehicle and gone by the rim, which is what
          // keeps the disc from ever showing its own edge.
          float lit = smoothstep(1.0, 0.05, away);
          // Every metre, and every fifth one heavier, so the eye reads a
          // scale off it without the whole floor turning into graph paper.
          float fine = rules(vXy, 1.0, 0.035);
          float coarse = rules(vXy, 5.0, 0.07);
          // How much of the mark colour a line lands. The fine ones stay
          // faint enough to be a scale rather than a surface of their own.
          // Carried in the alpha rather than mixed towards a surface: with
          // nothing underneath, laying the colour on at this strength and
          // mixing towards it from the page come out the same, and this way
          // there is no surface to keep in step with the page.
          float on = max(fine * 0.14, coarse * 0.3);
          gl_FragColor = vec4(rule, lit * on);
        }
      `,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  // Clear of the shadow catcher by a hair, so the depth test between them
  // has an answer rather than a coin toss.
  ground.position.y = 0.003;
  floor.add(ground);
  scene.add(floor);}
