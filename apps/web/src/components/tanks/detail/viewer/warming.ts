import type { MirrorModel } from "@unicum.gg/wargaming";

import { mirror } from "@/components/tanks/detail/viewer/mirror";
import { SKIN_FOLDER } from "@/services/tank-viewer/styles";

// Fetching a 3D style before anyone has asked for it.
//
// **A 3D style is another vehicle, and that is the whole problem.** A 2D style
// is paint on the tank already standing there, so it lands the moment it is
// picked. A 3D one is its own pieces and its own textures: measured on the
// Maus, 5.9 MB and a second and a half of network before a single triangle can
// be drawn. Nothing can make that instant, but almost nobody clicks an entry in
// a menu without passing over it first, and that pass is long enough to spend.
//
// Nothing is kept here: the files go into the browser's own HTTP cache, which
// is where the viewer would read them from anyway. So this owns no memory, and
// a style warmed and never picked costs exactly one cache entry the browser is
// free to drop.

/** Styles already asked for, so a reader sweeping the list pays once. */
const warmed = new Set<string>();

/**
 * How many files of one style are worth fetching ahead.
 *
 * A style is around five pieces and thirty textures, so this is not a limit
 * anything normal reaches: it is there because the list is read from a manifest
 * the mirror writes, and a manifest that grew strangely should cost a reader a
 * slower click rather than a hundred megabytes on a hover.
 */
const CEILING = 80;

/**
 * Pull a 3D style into the browser cache, once.
 *
 * Failures are silent and not remembered: this is an optimisation, and the
 * build that follows fetches the same files for real with its own error
 * handling. A style whose warming failed is simply warmed again next time.
 */
export async function warmSkin(code: string, folder: string): Promise<void> {
  const key = `${code}/${folder}`;
  if (warmed.has(key)) return;
  warmed.add(key);
  try {
    const { root, vehicles } = await mirror();
    const at = vehicles[code];
    if (!at) return;
    const base = `${root}/vehicles/${at}/${SKIN_FOLDER}/${folder}`;
    const answer = await fetch(`${base}/model.json`);
    if (!answer.ok) return;
    const model = (await answer.json()) as MirrorModel;
    const files = new Set<string>();
    for (const piece of Object.values(model.pieces ?? {})) {
      if (piece.glb) files.add(`${base}/${piece.glb}`);
    }
    // The standard definition set, which is what the viewer builds with: the
    // sharper one is a choice a reader makes after the vehicle is up, and
    // fetching both would double a hover for a picture nobody asked for.
    for (const material of model.materials ?? []) {
      for (const texture of Object.values(material.textures ?? {})) {
        if (texture?.path) files.add(`${root}/${texture.path}`);
      }
    }
    for (const file of [...files].slice(0, CEILING)) {
      // Low priority, because the vehicle on screen is still loading its own
      // textures on most of these hovers and it is the one being looked at.
      void fetch(file, { priority: "low" } as RequestInit).catch(() => {});
    }
  } catch {
    warmed.delete(key);
  }
}
