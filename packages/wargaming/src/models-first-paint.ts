// Which files a vehicle's first picture is made of.
//
// **Here rather than in the viewer, because two places now need the same
// answer.** The viewer reads the manifest and picks its pieces at the moment it
// builds them, which was fine while it was the only one asking. A page that
// wants those files fetched before the viewer exists has to name them from the
// server, and a name that differs by one file is not an error anybody sees: the
// browser fetches what was asked for, the viewer asks for something else, and
// the preload is simply paid for twice. So the rule lives once and both read it.
import type { MirrorModel } from "./models-shapes";

/** What a reader has mounted, by slot, under the game's own module names. */
export type MirrorMounted = Partial<Record<"gun" | "turret" | "chassis", string>>;

/**
 * The map slots a first picture actually samples, named rather than excluded.
 *
 * **An allowlist, because the consumer is one.** The viewer binds these five and
 * nothing else, so a denylist of the one slot it defers was right only for as
 * long as the mirror published nothing new: `g_heatMap` already ships on some
 * vehicles and was being fetched for nobody. A slot the mirror adds tomorrow is
 * then silently preloaded and silently unused, which is the failure this whole
 * module exists to make impossible.
 *
 * `metallicDetailMap` is deliberately absent: it is the client's shared grain,
 * 6.3 MB that every vehicle in the game names, and the viewer stands the tank up
 * on an invented one and fetches the real one afterwards.
 */
const PAINTED_SLOTS = [
  "diffuseMap",
  "normalMap",
  "metallicGlossMap",
  "excludeMaskAndAOMap",
  "colorIdMap",
] as const;

/**
 * The pieces a vehicle is drawn from, in the order they are assembled.
 *
 * A vehicle ships one turret and one gun per module a player can mount. The
 * reader's choice wins where they have made one, and the first by name is the
 * stock loadout, which is what a page carrying no choice shows.
 */
export function piecesOf(model: MirrorModel, mounted?: MirrorMounted): string[] {
  // A manifest with no pieces is a build older than this field, a half-written
  // file, or any 200 that parsed to an object of another shape: the fetch that
  // reads it casts rather than validates. Answering nothing is a vehicle drawn
  // without a head start, which is what it was before.
  const names = Object.keys(model.pieces ?? {}).sort();
  const chosen = (slot: keyof MirrorMounted) => {
    const key = mounted?.[slot];
    const piece = key ? model.modules?.[key] : undefined;
    return piece && model.pieces[piece] ? piece : undefined;
  };
  const first = (prefix: string) => {
    const slot =
      prefix === "Gun"
        ? "gun"
        : prefix === "Turret"
          ? "turret"
          : prefix === "Chassis"
            ? "chassis"
            : null;
    return (slot ? chosen(slot) : undefined) ?? names.find((n) => n.startsWith(prefix));
  };
  return ["Hull", "Chassis", "Turret", "Gun"]
    .map(first)
    .filter((n): n is string => n !== undefined);
}

/** The track link models, which are pieces of their own rather than a body part. */
function linksOf(model: MirrorModel): string[] {
  const t = model.tracks;
  if (!t) return [];
  return [t.segment, t.segment2, t.segmentRight, t.segment2Right].filter(
    (n): n is string => typeof n === "string" && Boolean(model.pieces[n]),
  );
}

/** The pieces the vehicle's prefab draws once per copy, the spider's legs. */
function copiedOf(model: MirrorModel): string[] {
  return [...new Set((model.copies ?? []).map((c) => c.piece))].filter(
    (n) => Boolean(model.pieces[n]),
  );
}

/**
 * Every file the vehicle's first picture reads, as mirror-relative paths.
 *
 * Geometry and maps are kept apart because a browser fetches them differently:
 * a `.glb` arrives through `fetch` and a texture through an `<img>`, and a
 * preload that names the wrong one of the two is a second copy rather than a
 * head start.
 */
export function firstPaintFiles(
  model: MirrorModel,
  { mounted }: { mounted?: MirrorMounted } = {},
): { geometry: string[]; textures: string[] } {
  if (!model?.pieces) return { geometry: [], textures: [] };
  const pieces = [...piecesOf(model, mounted), ...linksOf(model), ...copiedOf(model)];
  const geometry: string[] = [];
  const slots = new Set<number>();
  for (const name of pieces) {
    const piece = model.pieces?.[name];
    if (!piece) continue;
    if (!geometry.includes(piece.glb)) geometry.push(piece.glb);
    for (const mesh of piece.meshes ?? []) {
      for (const at of mesh.materials) slots.add(at);
    }
  }
  const textures: string[] = [];
  for (const at of slots) {
    const material = model.materials?.[at];
    for (const slot of PAINTED_SLOTS) {
      const entry = material?.textures?.[slot];
      if (!entry) continue;
      // The standard set, which is the one the hero opens on. The sharper
      // twin is a choice a reader makes once the vehicle is up, and naming
      // both would double the bytes for a picture nobody has asked for.
      if (entry.path && !textures.includes(entry.path)) textures.push(entry.path);
    }
  }
  return { geometry, textures };
}
