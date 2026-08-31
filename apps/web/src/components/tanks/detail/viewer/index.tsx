"use client";

import { useEffect, useRef, useState } from "react";
import { modelsRoot } from "@unicum.gg/wargaming";

// Where the geometry is read from. The mirror in production; a local tree in
// development, since a freshly generated catalogue is eighteen gigabytes and
// takes a while to reach GitHub. Point `NEXT_PUBLIC_MODELS_ROOT` at one with
// `ln -s <out> apps/web/public/models` and `/models`.
const MIRROR = process.env.NEXT_PUBLIC_MODELS_ROOT || modelsRoot();
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
const AZIMUTH = (20 * Math.PI) / 180;
const ELEVATION = (26 * Math.PI) / 180;
const DISTANCE = 0.725;
const ANCHOR_X = 0.3950;
const ANCHOR_Y = 0.3786;
const CENTROID_Y = 0.496;

// The vehicle, drawn from the geometry mirror, standing where the render was.
//
// **The picture stays the page's first paint.** A vehicle is around five
// megabytes of meshes and textures, so making it the hero's own content would
// trade a fast page for a slow one. It is built behind the render and fades in
// once it is ready, and a vehicle the mirror does not carry simply never fades.
/**
 * Which vehicles the mirror carries, and the nation folder each sits under.
 *
 * The page knows a vehicle by the nation the scripts give it, `ussr`, and the
 * mirror files it under the one the content gives it, `russian`; nothing in
 * either says so, so the mirror publishes the mapping. It doubles as the list
 * of what exists, which is how a vehicle with no model is told apart from a
 * request that failed. Fetched once for the whole session: it is 26 KB and the
 * same file for every tank.
 */
let index: Promise<Record<string, string>> | null = null;
function carried(): Promise<Record<string, string>> {
  index ??= fetch(`${MIRROR}/vehicles.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return index;
}

export function TankViewer({
  code,
  onReady,
}: {
  /** The code the game gives it, which is the folder's name, `R45_IS-7`. */
  code: string;
  onReady?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(false);
  // Only offered once the view has actually been moved: a button to undo
  // something nobody has done yet is furniture.
  const [moved, setMoved] = useState(false);
  const reset = useRef<(() => void) | null>(null);

  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let live = true;
    let stop: (() => void) | undefined;

    // Imported here rather than at the top so three and the loader stay out of
    // the page's own bundle: a tank page that nobody rotates should not pay for
    // a renderer.
    void (async () => {
      const [THREE, { OrbitControls }, { loadVisual }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        import("./visual.js"),
      ]);
      const nation = (await carried())[code];
      if (!live || !nation) return;

      const renderer = new THREE.WebGLRenderer({ canvas: surface, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
      const controls = new OrbitControls(camera, surface);
      controls.enableDamping = true;
      controls.enablePan = false;
      // The hero is a band, not a room: letting the camera under the floor or
      // straight overhead shows the one angle the vehicle has nothing on.
      controls.minPolarAngle = 0.35;
      controls.maxPolarAngle = Math.PI / 2.05;

      // **The pieces are hung off each other the way the vehicle is built**: the
      // hull rides on the chassis, the turret sits on the hull, the gun in the
      // turret. Where each ring is comes from the collision file, which is the
      // only thing that knows: a mesh carries no idea of where it belongs.
      //
      // Left at the origin, as a first pass had them, every piece is drawn in
      // the same place and the tank comes out as a heap with its tracks laid
      // over its roof.
      const armour = await fetch(`${MIRROR}/vehicles/${nation}/${code}/collision.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!live) return;
      const first = (prefix: string) =>
        Object.keys(armour?.parts ?? {})
          .sort()
          .find((n) => n.startsWith(prefix));
      const turretName = first("Turret") ?? "";

      // Something for the vehicle to stand on.
      //
      // **A hangar floor, not a photograph of one.** The picture it replaces is
      // shot from high above, so a model drawn at eye level on top of it reads
      // as pasted on; a floor built in the same space as the vehicle is seen
      // from wherever the vehicle is. It is a disc rather than a plane so it has
      // no edge to run into, faded out at the rim so it has no horizon either,
      // and a grid faint enough to give the eye a scale without becoming
      // graph paper.
      const floor = new THREE.Group();
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(26, 64),
        new THREE.ShaderMaterial({
          transparent: true,
          uniforms: { tint: { value: new THREE.Color(0x1b1f27) } },
          vertexShader: "varying vec2 vXy; void main() { vXy = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `
            uniform vec3 tint;
            varying vec2 vXy;
            void main() {
              float away = length(vXy) / 26.0;
              // Brightest under the vehicle and gone by the rim, which is what
              // keeps the disc from ever showing its own edge.
              float lit = smoothstep(1.0, 0.05, away);
              gl_FragColor = vec4(tint, lit * 0.9);
            }
          `,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      const grid = new THREE.GridHelper(40, 40, 0x2b3444, 0x222833);
      for (const line of Array.isArray(grid.material) ? grid.material : [grid.material]) {
        line.transparent = true;
        line.opacity = 0.35;
      }
      grid.position.y = 0.002;
      floor.add(ground, grid);
      scene.add(floor);

      const vehicle = new THREE.Group();
      const hull = new THREE.Group();
      hull.position.fromArray(armour?.hullPosition ?? [0, 0, 0]);
      const turret = new THREE.Group();
      turret.position.fromArray(armour?.mounts?.turret ?? [0, 0, 0]);
      const gun = new THREE.Group();
      gun.position.fromArray(armour?.mounts?.guns?.[turretName] ?? [0, 0, 0]);
      turret.add(gun);
      hull.add(turret);
      vehicle.add(hull);
      scene.add(vehicle);

      let built;
      try {
        built = await loadVisual({
          renderer,
          scene,
          root: MIRROR,
          vehicle: `${nation}/${code}`,
          mounts: { scene: vehicle, hull, turret, gun },
          definition: "sd",
        });
      } catch {
        // A vehicle the mirror does not carry, or a build that failed: the
        // render underneath is already the right thing to be looking at.
        return;
      }
      if (!live) {
        renderer.dispose();
        return;
      }
      // The loader brings its own hangar, its four lamps and the exposure they
      // were balanced against, and hands back the switch rather than throwing
      // them at the renderer: the armour views share this canvas and draw flat
      // answers an environment map would wash out. Nothing here draws anything
      // else yet, but leaving it off is what left the vehicle lit by the
      // renderer's defaults, a uniform gold with no reflection in it.
      built.show(true);

      // Framed on the vehicle rather than on a fixed distance, so a scout and a
      // Maus both fill the band.
      //
      // **The gun is left out of the measurement.** A long barrel drags the
      // bounding box a metre to one side, and centring that box shoves the hull
      // the other way: a long-barrelled tank destroyer ends up parked in the
      // corner. The picture this replaces anchors on the vehicle's centre of
      // mass for the same reason, the barrel carrying almost no area, and hull
      // and turret are the cheap way to the same place.
      const withGun = new THREE.Box3().setFromObject(vehicle);
      // Lifted out for the measurement and put straight back: the gun hangs off
      // the turret, so there is no measuring the rest without detaching it.
      turret.remove(gun);
      const bounds = new THREE.Box3().setFromObject(vehicle);
      turret.add(gun);
      const centre = bounds.getCenter(new THREE.Vector3());
      // The distance still has to clear the whole vehicle, gun included, or the
      // barrel leaves the frame.
      const radius = withGun.getSize(new THREE.Vector3()).length() / 2;
      // The angle the pipeline's own viewer settles on, and the one an armour
      // model is read from: far enough back that a scout and a Maus both fit,
      // and off to one side so a face and a flank are in view at once. Copied
      // rather than re-chosen, because a hero framed by taste drifts from the
      // thing it is supposed to be showing.
      const fit = (DISTANCE * radius) / Math.sin((camera.fov * Math.PI) / 360);
      const towards = new THREE.Vector3(
        Math.cos(ELEVATION) * Math.sin(AZIMUTH),
        Math.sin(ELEVATION),
        Math.cos(ELEVATION) * Math.cos(AZIMUTH),
      );
      controls.target.copy(centre);
      camera.position.copy(centre).addScaledVector(towards, fit);
      controls.update();
      // The framing to come back to.
      //
      // Through the controls' own save and restore rather than by putting the
      // camera back: with damping on they keep easing toward wherever the drag
      // was heading, so a camera moved underneath them is dragged off again over
      // the following frames and lands a couple of points from where it started.
      const home = camera.position.clone();
      controls.saveState();
      reset.current = () => {
        // Damping off for the one update that puts it back: the controls only
        // clear the momentum left by a drag on an undamped pass, so restoring
        // the saved state with damping on lands two points short and creeps.
        controls.enableDamping = false;
        controls.reset();
        controls.update();
        controls.enableDamping = true;
        setMoved(false);
      };
      controls.addEventListener("change", () => {
        setMoved(camera.position.distanceTo(home) > 0.05);
      });

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = surface;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // **Stand where the picture stood, so the swap is not a jump.**
        //
        // WG's portal renders put a vehicle's alpha centroid at a fixed place in
        // their 1920x900 frame, and the render route re-frames our own mirror
        // crops into that same layout; the hero is 32:15, the same ratio, so the
        // picture maps onto it without cropping and that place is a plain
        // fraction of the canvas. Framing the model dead centre instead put it a
        // tenth of a width off, which is small enough to read as a nudge and
        // large enough to see.
        //
        // Done with a view offset rather than by moving the camera: the frustum
        // shifts and the camera does not, so orbiting still turns about the
        // vehicle rather than about a point beside it.
        camera.setViewOffset(w, h, (0.5 - ANCHOR_X) * w, (ANCHOR_Y - 0.5) * -h, w, h);
        camera.updateProjectionMatrix();
      };
      resize();
      const watching = new ResizeObserver(resize);
      watching.observe(surface);

      let frame = 0;
      const draw = () => {
        frame = requestAnimationFrame(draw);
        controls.update();
        renderer.render(scene, camera);
      };
      draw();
      setShown(true);
      onReady?.();

      stop = () => {
        cancelAnimationFrame(frame);
        watching.disconnect();
        controls.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      live = false;
      stop?.();
    };
  }, [code, onReady]);

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      {shown && moved ? (
        // Bottom left, which is the one corner of the hero nothing else claims:
        // the title sits above it and the cost panel fills the other side.
        <button
          type="button"
          onClick={() => reset.current?.()}
          className="absolute bottom-3 left-3 rounded-md border border-fd-border/60 bg-fd-background/70 px-2.5 py-1.5 text-xs font-medium text-fd-muted-foreground backdrop-blur transition-colors hover:text-fd-foreground"
        >
          Reset view
        </button>
      ) : null}
    </>
  );
}
