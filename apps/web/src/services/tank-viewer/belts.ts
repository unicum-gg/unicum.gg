import * as THREE from "three";

import type { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { MirrorBeltRun, MirrorModel } from "@unicum.gg/wargaming";
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
    // **Each side gets the link the chassis put on it.** A shoe plate is not
    // symmetric, so 58 vehicles name a different file for the right, and laying
    // the left one down both sides reads as a track fitted backwards.
    // Falling back to the run's own left link, never to the belt's first one: a
    // right side that names no second link still lays the second run.
    const held = (piece: string | undefined, instead: string) =>
      piece && model.pieces[piece] ? piece : instead;
    const runs: {
      piece: string;
      start: number;
      side: string;
      /** The pitch to step at, or nothing where the mesh's own length does. */
      pitch?: number;
      /** The wheels this run goes around, where the mirror names them. */
      wheels?: string[];
    }[] = [];
    // **Every run the chassis authored, laid where it was authored.** A vehicle
    // wears one belt a side almost always and two on 23 of them: fore and aft
    // on the AE Phase I and the ST-66, inboard and outboard on the FV4025
    // Contriver and the Object 279 (e). The client declares a `trackPair` per
    // belt and the mirror publishes a path for each, so there is nothing here
    // to choose between. What is published is what the game draws.
    for (const side of Object.keys(tracks.paths)) {
      // **Any run down the right, not only the first.** A vehicle with more
      // than one belt a side names the outer ones `right1`, `right2`, and the
      // link a shoe plate puts on the right belongs on all of them. Matched on
      // the prefix, which is what the mirror keys them by.
      const right = side.startsWith("right");
      // What this run does differently from the belt as a whole, which is
      // nothing at all on a vehicle that declares one belt.
      const own: MirrorBeltRun = tracks.belts?.[side] ?? {};
      const first = held(
        right ? (own.segmentRight ?? tracks.segmentRight) : undefined,
        own.segment ?? tracks.segment,
      );
      // **A belt is one or two runs, and the chassis says which.** It names a
      // second link model and gives each run its own start along the path, half
      // a pitch apart, so what reads as one belt is two interleaved. A vehicle
      // that names only one is laid as one.
      const second = own.segment2 ?? tracks.segment2;
      const twin = second ? model.pieces[second] : undefined;
      // **The declared pitch, but only where the links interleave.** The client
      // lays two models half a pitch apart, and the pitch it declares is the
      // pitch of one run: 300 mm on the E 100, a link every 150 once both are
      // down. Laying the one model we carry at that half step instead overlaps
      // each 205 mm link with the next by 55, which is worse than the honest
      // single run, so a lone run falls back to the mesh's own length.
      const pitch = twin
        ? (own.segmentLength ?? tracks.segmentLength)
        : undefined;
      // `segment2Offset` is measured from the first run rather than from the
      // path, which is how the client reads it.
      const opening = own.segmentOffset ?? tracks.segmentOffset ?? 0;
      runs.push({ piece: first, start: opening, side, pitch, wheels: own.wheels });
      if (twin && second)
        runs.push({
          piece: held(
            right ? (own.segment2Right ?? tracks.segment2Right) : undefined,
            second,
          ),
          start: opening + (own.segment2Offset ?? tracks.segment2Offset ?? 0),
          side,
          pitch,
          wheels: own.wheels,
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
        // **The link's own length, where no declared pitch can be used.**
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
        // A chained belt sidesteps all of this: the chassis counts its links
        // rather than describing a step, so the count is laid as given and the
        // pitch falls out of the path. The Strv 103B's link is 173 mm long and
        // its chassis counts 86 of them round an 11.2 m band, a 130 mm step, so
        // its plates overlap as they do in the game instead of standing apart.
        const length = run.pitch ?? box.max.z - box.min.z;
        // The client's own path for this side, which is where the belt runs,
        // and how far outside it the belt's own body stands: a link is
        // modelled from the tip of its centre guide, so laid by its origin the
        // whole belt sits a guide's height too far out.
        const laid = layTrack(
          o.geometry,
          material(model.materials[order[i] ?? -1]),
          path,
          length,
          run.start,
          tracks.segments,
          tracks.standoffs?.[run.side],
        );
        laid.mesh.castShadow = true;
        laid.mesh.receiveShadow = true;
        scene.add(laid.mesh);
        parts.push(laid.mesh);
        // Assigned onto the belt rather than spread into a copy: `total` is a
        // getter that follows a reshaped path, and a spread would freeze it at
        // the length the belt happened to have when it was laid.
        belts.push(
          Object.assign(laid, { at: path[0]![0]!, wheels: run.wheels }),
        );
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
