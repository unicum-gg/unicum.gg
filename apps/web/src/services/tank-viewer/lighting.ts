// The room the vehicle is lit in.
//
// Every constant here was measured against captures of the game rather than
// chosen, which is why it is carried over whole: an invented studio is what the
// first attempt at porting this shipped, and a hull lit by a renderer's
// defaults reads as a uniform gold with no reflection in it.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";

/**
 * What the paint has to reflect.
 *
 * The game's own shader is `NormalsGGXRough` over an `EnvBRDFLut`: GGX with a
 * split-sum environment, which is what three does too. So the model is not the
 * difference between its look and ours — what is reflected is. A tank's shell
 * is a wide, gently curved, fairly smooth surface, and on that kind of surface
 * almost everything the eye reads as "metal" is a reflection of something
 * bright and shaped. An evenly lit room reflects as a flat sheen and the hull
 * goes dead.
 *
 * So this is a hangar rather than a room: a dark shell, a bright sky above, a
 * dim floor below, and long strip lights overhead whose reflections travel
 * along the hull as it turns.
 */
export function hangar() {
  const room = new THREE.Scene();

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(12, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      // Sky to horizon to floor, the horizon kept bright: it is the band a
      // curved flank actually reflects when the camera sits at eye level.
      fragmentShader: `
        varying vec3 vDir;
        void main() {
          float up = normalize(vDir).y;
          // Cool from above, warm from below. The ground tone is not decoration:
          // the underside of a hull and the whole run of a track see almost
          // nothing but the floor, so its colour is the colour they come out.
          // A near-black floor is what left ours a flat neutral grey where the
          // game has warm, rusted steel.
          // Near neutral, and that is the point. Measured against a capture of
          // the game itself, a warm shell and a warm key push a vehicle well
          // past what the game shows: the game's IS-7 measures 0.177 mean
          // saturation and our warmed rig gave 0.331, nearly double. The colour
          // in the game's tank is in its **paint**, not in its lamps, and the
          // proof is that neutral white light on these textures still comes out
          // at the game's own warmth of R-B 18.
          // **Dark shell, bright lamps.** The gradient is the part of the room
          // that reflects as a flat wash, and the panels are the part that
          // reflects as shape. Once the environment carries the lighting at 2.8
          // rather than 0.6, a shell this bright stops being a room and becomes
          // a fog: the first attempt at the new ratio kept these at 0.50 and
          // the tank came out pale and chalky. Divided by three the ambient
          // lands about where it did before while the lamps reflect nearly five
          // times harder, which is the whole point of the change.
          vec3 sky = vec3(0.17, 0.18, 0.20);
          vec3 horizon = vec3(0.23, 0.21, 0.19);
          vec3 floorTone = vec3(0.14, 0.12, 0.09);
          vec3 tint = up > 0.0 ? mix(horizon, sky, pow(up, 0.55)) : mix(horizon, floorTone, pow(-up, 0.5));
          gl_FragColor = vec4(tint, 1.0);
        }
      `,
    }),
  );
  room.add(shell);

  // What the shell cannot give: shape.
  //
  // A gradient reflects as a gradient, which is why a smooth flank came out as
  // one clean sheet of light however the tones were tuned. Paint reads as paint
  // when the room it stands in has edges in it: banks of light overhead, panels
  // of different brightness down the walls, dark between them. These are what
  // travel across a hull as the camera moves, and they are the difference
  // between a lit object and a photographed one.
  const panel = (
    colour: number,
    width: number,
    height: number,
    place: [number, number, number],
    turn?: [number, number, number],
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }),
    );
    mesh.position.set(...place);
    if (turn) mesh.rotation.set(...turn);
    room.add(mesh);
    return mesh;
  };

  // Overhead: two banks either side of the vehicle and one across the back, the
  // long thin shape a hangar fitting actually has.
  for (const [x, z, length] of [[-3.6, 0, 14], [3.6, 0, 14], [0, -5.5, 9], [0, 5.5, 9]]) {
    panel(0xffffff, 0.7, length, [x, 7.5, z], [Math.PI / 2, 0, 0]);
  }
  // A second, dimmer tier further out, so a highlight has somewhere to fade to
  // rather than ending at the edge of the first.
  for (const [x, z] of [[-6.5, -3], [6.5, -3], [-6.5, 3], [6.5, 3]]) {
    panel(0x6e747c, 2.4, 6, [x, 7.2, z], [Math.PI / 2, 0, 0]);
  }

  // The walls, unequal on purpose: a room lit the same on both sides gives a
  // vehicle two identical flanks and no sense of where it is standing.
  panel(0xb8a894, 4, 10, [-7.5, 1.9, 2], [0, Math.PI / 2, 0]);
  panel(0x555c66, 4.5, 12, [-7.6, 4.4, -2], [0, Math.PI / 2, 0]);
  panel(0x8f8578, 3.2, 9, [7.5, 2.2, -1], [0, Math.PI / 2, 0]);
  panel(0x3a4048, 5, 11, [7.6, 5, 3], [0, Math.PI / 2, 0]);
  // The far end, dim, so a nose or a tail turned away still has an edge.
  panel(0x4a525c, 12, 5, [0, 3, -9], [0, 0, 0]);

  return room;
}


/**
 * The lamps that shape what the environment lights, and the shadow they cast.
 *
 * Built beside the room rather than inside it: the environment map is baked
 * once from `hangar()`, and these four are what travel across a hull as it
 * turns. They are handed back as a group so the caller can take them off the
 * scene again, since the armour views share this canvas and draw flat answers
 * an environment map would wash out.
 */
export function studio(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  // Lit like a hangar, and only while this view is the one on screen: the
  // armour views draw their own answers and an environment map would wash them.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(hangar(), 0.02).texture;
  pmrem.dispose();
  const lights = new THREE.Group();
  // **The environment carries the light, and the lamps only shape it.**
  //
  // We had it the other way round: a key at 8, an environment at 0.6 and an
  // exposure of 2.1. That is a lot of white light thrown at a tank, and it
  // reads exactly as it sounds, flat and cold and too bright. Inverting the
  // ratio is what fixes it, and the whole difference is in four numbers: the
  // environment does 2.8 against the old 0.6, the lamps are a third of the
  // strength, and the exposure is 1.42 rather than 2.1. What brightness costs
  // there it buys back in reflection, which is what a painted steel surface
  // actually does with light.
  //
  // The colours matter as much. Their key is a warm peach and their fill a warm
  // cream, with a single cool rim to separate the silhouette. Ours were all
  // within a hair of white, and white light on grey-green paint is the look of
  // a render rather than of a tank in a hangar.
  //
  // Sky and ground, with the ground the warm brown a hangar floor is.
  lights.add(new THREE.HemisphereLight(0xd9ecff, 0x9b8065, 1.45));
  const key = new THREE.DirectionalLight(0xffd39f, 2.6);
  key.position.set(5.5, 3.6, 4.5);
  // Shadows are what stops a tank floating over the grid, and they do as much
  // for the shape as the textures do: without them a gun casts nothing on the
  // hull, a fender casts nothing on the track, and every recess reads as paint
  // rather than as a recess.
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  // A shallow bias, since the surfaces casting on each other are millimetres
  // apart in places: too much and a gun stops shadowing its own mantlet.
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  lights.add(key);

  // The ground takes the shadow without being drawn itself, so the grid still
  // shows through and nothing is added to the scene that the tank is not.
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.45 }),
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.receiveShadow = true;
  lights.add(shadowCatcher);
  // Warm, and opposite the key. Both lamps on the warm side and one cool rim
  // is what gives the paint its temperature: a fill that is merely white flattens
  // the shadowed side into grey.
  const fill = new THREE.DirectionalLight(0xffe0b8, 1.85);
  fill.position.set(-4.8, 2.8, -4.2);
  lights.add(fill);

  // A rim, from behind and above, opposite the key.
  //
  // The one light in a studio rig that is not there to reveal a surface: it
  // catches the edge where the vehicle turns away, and that bright line is what
  // separates a dark hull from a dark background. Without it an object sits on
  // a backdrop; with it, it stands in front of one. It is the light the rig was
  // missing.
  const rim = new THREE.DirectionalLight(0x9fc7ff, 1.75);
  rim.position.set(-4.6, 3.4, 4.6);
  lights.add(rim);

  // One lamp hung over the tank, close enough for its falloff to show.
  //
  // The only light in the rig that is not at infinity, so it is the only one
  // whose brightness changes along the hull. That gradient is what stops a long
  // flat deck reading as one painted sheet.
  const overhead = new THREE.PointLight(0xcfe4ff, 48, 8);
  overhead.position.set(0, 5.8, 0.7);
  lights.add(overhead);
  // High, and the exposure brought down to pay for it.
  //
  // Raising this on its own does wash a surface out, which is what an earlier
  // pass here concluded and why it sat at 0.6. The conclusion was half of one:
  // the environment can carry the light as long as the exposure comes down with
  // it, and then it stops being a wash and starts being reflection. Held
  // together the two numbers are what a painted steel plate looks like.
  scene.environmentIntensity = 2.8;
  scene.add(lights);
  return {
    environment,
    lights,
    /**
     * Give the room back.
     *
     * **Taking the group off the scene frees none of it.** The environment is a
     * cube render target the card is holding, and the ground that catches the
     * shadow is a real mesh with a real material, so a rebuild that only
     * detached them left both behind on a context it reuses.
     */
    dispose() {
      lights.parent?.remove(lights);
      lights.traverse((one) => {
        const mesh = one as THREE.Mesh;
        mesh.geometry?.dispose();
        const worn = mesh.material;
        if (Array.isArray(worn)) for (const each of worn) each.dispose();
        else worn?.dispose();
      });
      environment.dispose();
      scene.environment = null;
    },
  };
}
