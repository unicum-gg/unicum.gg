import { WotSrcBranch } from "./source/wot/mirror";

// Our mirror of the client's vehicle geometry (`unicum-gg/wot.models`): the
// armor a shell has to get through, and the model a player sees. WG publishes
// neither, because both are binary, which is what stops a site from drawing a
// tank at all.
//
// It sits beside `assets-mirror.ts` and works the same way, for the same reason:
// one place names the repository and the branch, so renaming either does not
// mean hunting for the three consumers that each wrote it out again.
export const MODELS_REPO = "unicum-gg/wot.models";

/** The live client's branch. One copy serves every region: unlike the scripts,
 * the geometry does not differ between them. */
export const MODELS_BRANCH = "WG";

/** The Common Test branch, where a vehicle's model exists weeks before it does
 * anywhere else. */
export const MODELS_BRANCH_CT = "WG_CT";

/** The geometry branch matching a branch of the client-scripts mirror, so a
 * vehicle read from the test scripts is drawn with the test client's model.
 * Undefined for a live branch, which is `modelUrl`'s default. */
export function modelsRefFor(branch?: WotSrcBranch): string | undefined {
  return branch === WotSrcBranch.CT ? MODELS_BRANCH_CT : undefined;
}

/**
 * Where a consumer reads the mirror from.
 *
 * A viewer fetches dozens of files per vehicle and builds their paths itself,
 * so it wants the root rather than one URL at a time. It also wants to be able
 * to point somewhere else entirely: a freshly generated catalogue is eighteen
 * gigabytes and is read off a local tree long before it reaches the mirror,
 * which a helper returning a whole github URL per file could not allow.
 *
 * Under the root the mirror keeps the client's own layout,
 * `vehicles/russian/R45_IS-7`, because that is what the extraction reads and
 * what makes a file findable from a client path. **The path comes from the
 * index and is never built from the code**: a vehicle does not always draw from
 * a folder of its own name, since an event reskin, a clan reissue and a code
 * that drifted from the folder made for it all read another vehicle's meshes,
 * so `G98_Waffentrager_E100_P` lives under `german/G98_Waffentrager_E100`.
 */
export function modelsRoot(ref: string = MODELS_BRANCH): string {
  return `https://raw.githubusercontent.com/${MODELS_REPO}/${ref}`;
}

/** Raw-content URL for `path` on the wot.models mirror. */
export function modelUrl(path: string, ref: string = MODELS_BRANCH): string {
  return `https://raw.githubusercontent.com/${MODELS_REPO}/${ref}/${path}`;
}

/** The catalogue of 2D styles, published once for the whole mirror rather than
 * beside every vehicle: the recipes are the same on every vehicle that can wear
 * them, and a vehicle keeps only which it is offered and its own tiling. */
export function styleCatalogueUrl(ref?: string): string {
  return modelUrl("styles2d.json", ref);
}
