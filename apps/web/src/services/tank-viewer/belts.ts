import * as THREE from "three";

import type { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { MirrorModel } from "@unicum.gg/wargaming";
import { layTrack } from "./track";
import type { LaidBelt } from "./running-gear";
import type { Brush, MaterialShop } from "./materials";

// Laying the belt the client ships, rather than drawing the ribbon it also
// ships.
//
// The fixed ribbon is in the vehicle's own meshes and is what a viewer gets for
// free; it reads as a decal the moment anything moves. The belt is one link
// model repeated along a closed path, which is what the game does, and putting
// it together is enough of its own problem to sit beside the path reader rather
// than inside the loader.

/** `Mesh` carries no discriminant in its type, so the renderer's flag narrows. */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh =>
  (o as THREE.Mesh).isMesh === true;

/** The ribbon baked into a vehicle's own meshes, hidden once a belt is laid. */
const RIBBON = /^track_/;

/** Lay both sides of a vehicle's belt, and say what it cost to draw. */
export async function layBelts({
  model,
  loader,
  root,
  vehicle,
  fresh,
  scene,
  parts,
  material,
  brush,
}: {
  model: MirrorModel;
  loader: GLTFLoader;
  root: string;
  vehicle: string;
  fresh: (url: string) => string;
  /** Where a laid run is hung, which is the scene the vehicle stands in. */
  scene: THREE.Object3D;
  /** What is on it, which the laid runs join. */
  parts: THREE.Object3D[];
  /** The shop's material factory, so a link is shaded like the vehicle. */
  material: (spec: Parameters<MaterialShop["material"]>[0]) => THREE.Material;
  brush: Brush;
}): Promise<{ belts: LaidBelt[]; links: number; triangles: number }> {
  // The real track: one link repeated along the path the client ships.
  const belts: LaidBelt[] = [];
  let links = 0;
  let triangles = 0;
  const tracks = model.tracks;
  if (tracks && model.pieces[tracks.segment]) {
    // **A belt is one or two runs, and the chassis says which.** It names a
    // second link model and gives each run its own start along the path, half a
    // pitch apart, so what reads as one belt is two interleaved. A vehicle that
    // names only one is laid as one.
    // **Two runs only where there are two links to lay.** The client's belt is
    // two different link models interleaved half a pitch apart, and the pitch it
    // declares is the pitch of one run: 300 mm on the E 100, a link every 150
    // once both are down. Laying the one model we carry at that half step
    // instead overlaps each 205 mm link with the next by 55, which is worse
    // than the honest single run. So the declared pitch is used only when the
    // second link is there to justify it.
    //
    // `segment2Offset` is measured from the first run rather than from the
    // path, which is how the client reads it.
    const twin = tracks.segment2 ? model.pieces[tracks.segment2] : undefined;
    const opening = tracks.segmentOffset ?? 0;
    // **Each side gets the link the chassis put on it.** A shoe plate is not
    // symmetric, so 58 vehicles name a different file for the right, and laying
    // the left one down both sides reads as a track fitted backwards.
    // Falling back to the run's own left link, never to the belt's first one: a
    // right side that names no second link still lays the second run.
    const held = (piece: string | undefined, instead: string) =>
      piece && model.pieces[piece] ? piece : instead;
    const runs: { piece: string; start: number; side: string }[] = [];
    for (const side of Object.keys(tracks.paths)) {
      const right = side === "right";
      runs.push({
        piece: held(right ? tracks.segmentRight : undefined, tracks.segment),
        start: opening,
        side,
      });
      if (twin)
        runs.push({
          piece: held(
            right ? tracks.segment2Right : undefined,
            tracks.segment2!,
          ),
          start: opening + (tracks.segment2Offset ?? 0),
          side,
        });
    }
    brush.part = "chassis";
    // Two sides on one link is the common case, so the file is read once.
    const read = new Map<string, Promise<GLTF>>();
    for (const run of runs) {
      const segment = model.pieces[run.piece]!;
      const path = tracks.paths[run.side];
      if (!path || path.length < 3) continue;
      brush.piece = run.piece;
      let loading = read.get(run.piece);
      if (!loading) {
        loading = loader.loadAsync(
          fresh(`${root}/vehicles/${vehicle}/${segment.glb}`),
        );
        read.set(run.piece, loading);
      }
      const gltf = await loading;
      const source: THREE.Mesh[] = [];
      gltf.scene.traverse((o) => {
        if (isMesh(o)) source.push(o);
      });
      const order = (segment.meshes ?? []).flatMap((m) => m.materials);
      source.forEach((o, i) => {
        if (!o.geometry.getAttribute("uv1"))
          o.geometry.setAttribute("uv1", o.geometry.getAttribute("uv"));
        o.geometry.computeBoundingBox();
        const box = o.geometry.boundingBox;
        if (!box) return;
        // **The declared pitch, but only where the link can take it.**
        //
        // A link overlaps its neighbour at the pin, so its own length is not
        // the step: the E 100's mesh is 205 mm long and its belt steps 150.
        // What makes that overlap read as a chain rather than as a pile is
        // that the 55 mm it gives up are the lug forks, which are narrow: its
        // full-width plate is 114 mm and never meets the next one.
        //
        // The Tiger's link is not built that way. It is 180 mm long and plated
        // nearly end to end, so stepping it at the 123 mm its chassis declares
        // drives 57 mm of one plate through the next, and the belt comes out
        // scaled and canted. The client lays that pitch on a mesh we do not
        // have, and guessing which is not something the mirror can answer yet.
        //
        // So the pitch is taken where the links interleave, which is a belt of
        // two models, and the mesh's own length is what puts a single run end
        // to end. That is the honest reading of what the mirror carries.
        // A chained belt sidesteps all of this: the chassis counts its links
        // rather than describing a step, so the count is laid as given and the
        // pitch falls out of the path. The Strv 103B's link is 173 mm long and
        // its chassis counts 86 of them round an 11.2 m band, a 130 mm step, so
        // its plates overlap as they do in the game instead of standing apart.
        const length =
          twin && tracks.segmentLength
            ? tracks.segmentLength
            : box.max.z - box.min.z;
        // The client's own path for this side, which is where the belt runs.
        const laid = layTrack(
          o.geometry,
          material(model.materials[order[i] ?? -1]),
          path,
          length,
          run.start,
          tracks.segments,
        );
        laid.mesh.castShadow = true;
        laid.mesh.receiveShadow = true;
        scene.add(laid.mesh);
        parts.push(laid.mesh);
        // Assigned onto the belt rather than spread into a copy: `total` is a
        // getter that follows a reshaped path, and a spread would freeze it at
        // the length the belt happened to have when it was laid.
        belts.push(Object.assign(laid, { sign: Math.sign(path[0]![0]!) }));
        links += laid.count;
        triangles += ((o.geometry.index?.count ?? 0) / 3) * laid.count;
      });
    }
    for (const part of parts)
      part.traverse((o) => {
        if (isMesh(o) && RIBBON.test(o.name)) o.visible = false;
      });
  }
  return { belts, links, triangles };
}
