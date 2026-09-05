// A vehicle's wardrobe, assembled from the two files it arrives in.
//
// The client's styles are published in two pieces, and for a good reason: a
// recipe is the same on every vehicle that can wear it, so the 845 of them are
// written once at the root, and a vehicle keeps only which of them it is offered
// plus the handful whose tiling the client tuned for its own hull.
//
// This puts the two back together. What it hands back is what the vehicle can
// actually be dressed in, in the catalogue's own order, with its own tiling
// already applied.
import type { MirrorStyle, MirrorStylePatch } from "@unicum.gg/wargaming";

/** What a 3D style is called, and the swatch the client draws it with. */
export type SkinFace = { name: string; icon?: string };

/**
 * The catalogue, fetched once for the whole session.
 *
 * It is two megabytes and it is the same file for every tank on the site, so
 * the second vehicle a reader opens pays nothing for it. Held as the promise
 * rather than the value so that two vehicles opened at once share one request.
 */
let catalogue: Promise<MirrorStyle[]> | null = null;
let named: Promise<Record<string, SkinFace>> | null = null;

/**
 * The folder a vehicle keeps its 3D styles in, one full set of pieces per name.
 *
 * The same name the generator writes, and the whole of what wearing one costs a
 * viewer: a style is reached exactly the way the vehicle is, from one folder
 * deeper.
 */
export const SKIN_FOLDER = "_skins";

/** A vehicle the mirror has no wardrobe for: offered nothing, tuned nothing. */
const BARE: MirrorStylePatch = { offers: [], tiling: [] };

function all(
  root: string,
  fresh: (url: string) => string,
): Promise<MirrorStyle[]> {
  // **A failure is not memoised.** Kept, one dropped connection would answer
  // every later request for the life of the page with the empty fallback, and
  // the wardrobe would stay empty until a reload with nothing saying why.
  catalogue ??= fetch(fresh(`${root}/styles2d.json`))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no catalogue"))))
    .catch(() => {
      catalogue = null;
      return [] as MirrorStyle[];
    });
  return catalogue;
}

/**
 * What each 3D style is called, by the folder it is published under.
 *
 * The folders are the client's own, `A120_M48A5_3DSt_TLXXL`, and a wardrobe
 * offering those is offering nothing a player recognises: the game calls that
 * one "Tiger Claw". One table for the whole catalogue, fetched once, since a
 * style names one model set and no two vehicles share one.
 */
export function skinNames(
  root: string,
  fresh: (url: string) => string = (url) => url,
): Promise<Record<string, SkinFace>> {
  named ??= fetch(fresh(`${root}/skins.json`))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no names"))))
    .then((table: Record<string, string | SkinFace>) =>
      // **Both shapes read.** The table was a folder and a name, and now
      // carries the swatch beside it. A mirror published before that change
      // still answers with the string, and the wardrobe simply has no picture
      // for it rather than no name.
      Object.fromEntries(
        Object.entries(table).map(([folder, face]) => [
          folder,
          typeof face === "string" ? { name: face } : face,
        ]),
      ),
    )
    .catch(() => {
      named = null;
      return {};
    });
  return named;
}

/**
 * What this vehicle can be dressed in.
 *
 * **The vehicle's tiling is applied onto a copy, never onto the catalogue.**
 * The recipes are shared by every tank on the site, and a patch written into
 * them would follow the reader to the next vehicle and dress it in the last
 * one's measurements.
 *
 * Returns an empty list rather than throwing where either file is missing: a
 * vehicle nobody can dress is a control not offered, not a broken page.
 */
export async function wardrobeFor(
  root: string,
  vehicle: string,
  at: string,
  fresh: (url: string) => string = (url) => url,
): Promise<MirrorStyle[]> {
  const [styles, patch] = await Promise.all([
    all(root, fresh),
    fetch(fresh(`${root}/vehicles/${vehicle}/${at}`))
      .then((r) => (r.ok ? (r.json() as Promise<MirrorStylePatch>) : BARE))
      .catch(() => BARE),
  ]);
  const offered = new Set(patch.offers);
  const tuned = new Map<string, [number, number, number, number]>();
  for (const [id, outfit, camo, figures] of patch.tiling) {
    tuned.set(`${id}/${outfit}/${camo}`, figures);
  }
  return styles
    .filter((style) => offered.has(style.id))
    .map((style) => ({
      ...style,
      outfits: style.outfits.map((outfit, o) => ({
        ...outfit,
        camouflages: outfit.camouflages.map((camouflage, c) => {
          const own = tuned.get(`${style.id}/${o}/${c}`);
          return own
            ? {
                ...camouflage,
                factor: [own[0], own[1]],
                offset: [own[2], own[3]],
              }
            : camouflage;
        }),
      })),
    }));
}
