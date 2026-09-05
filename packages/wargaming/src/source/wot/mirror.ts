import { Region } from "../../region";

// Our own mirror of IzeBerg/wot-src (the WoT client scripts). We point at our
// fork rather than upstream so the catalogue depends only on infrastructure we
// control: the `unicum-gg/wot.src` branches are kept fast-forwarded to upstream
// by a scheduled sync, and if upstream ever goes private we keep serving the
// last synced state instead of breaking.
export const REPO = "unicum-gg/wot.src";

// The mirror branches we read. Three track a live regional client; `CT` is the
// Common Test build, which is where a vehicle appears weeks before release. The
// mirror carries more branches (RU, PT_RU, CN) that the catalogue never fetches.
export enum WotSrcBranch {
  EU = "EU",
  NA = "NA",
  ASIA = "ASIA",
  CT = "CT",
}

/**
 * The client build a branch of the mirror was extracted from, e.g. `2.4.0.5415`.
 *
 * The build stamps it into `.version_name` at the branch root, which is the only
 * place the human-readable version appears: the client's own files carry an
 * internal number instead. Null when the branch has never been built.
 */
export async function fetchBranchVersion(
  branch: WotSrcBranch,
  getText: (url: string) => Promise<string>,
): Promise<string | null> {
  try {
    const raw = await getText(rawUrl(branch, ".version_name"));
    const version = raw.trim();
    return version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

/**
 * Order two client build versions (`2.4.0.5415`), component by component, as a
 * comparator: negative when `a` is older, positive when newer, zero when equal.
 *
 * Numeric per component rather than lexicographic, or `2.10` would sort before
 * `2.9`. A component that is not a number counts as 0, and a shorter version is
 * padded, so `2.4` and `2.4.0.0` are the same build.
 */
export function compareBuildVersions(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number.parseInt(pa[i] ?? "0", 10) || 0;
    const nb = Number.parseInt(pb[i] ?? "0", 10) || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/** Raw-content URL for `path` on `branch` of the wot-src mirror. */
export function rawUrl(branch: WotSrcBranch, path: string): string {
  return `https://raw.githubusercontent.com/${REPO}/${branch}/${path}`;
}

// The mirror's XML/PO files change only on a game patch. They are static between
// patches and heavily shared across tanks (the per-nation component files back
// every tank of that nation), so we cache each raw fetch. Without this the shared
// files are re-fetched once per tank, turning a single tank page into ~9
// GitHub-raw round trips. Passed as `cache` (ms) to `transport.getText`.
//
// It must stay STRICTLY SHORTER than the catalogue cron's period, and that is the
// whole reason it is not a day. At a day it matched the cron exactly, so each tick
// read a body the previous tick had cached and a build published in between was
// picked up a tick late, or two: update 2.4 landed on the mirror on 28/08/2026 at
// 17:47 and the map history recorded it on the 30th at 07:02. Shorter than the
// period, every tick reads the mirror for real and the lag is the period itself.
export const WOTSRC_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export const BRANCH_BY_REGION: Record<Region, WotSrcBranch> = {
  [Region.EU]: WotSrcBranch.EU,
  [Region.NA]: WotSrcBranch.NA,
  [Region.ASIA]: WotSrcBranch.ASIA,
};

/**
 * Which branch to read for one region, optionally overridden.
 *
 * Every source resource resolves its branch through here rather than indexing
 * `BRANCH_BY_REGION` directly, so a caller holding a Common Test vehicle can
 * ask for its data without the region having to lie about which client it is.
 */
export const branchFor = (region: Region, override?: WotSrcBranch) =>
  override ?? BRANCH_BY_REGION[region];

/**
 * Which branch to read a branch's *strings* from.
 *
 * A `.po` file is not per-client data, it is per-language, and the mirror's
 * branches are not all the same language: the Common Test one is extracted from
 * a Russian build, so every string on it (`Бронебойный` for AP, `Ремонт` for
 * Repairs) comes back in Russian while the numbers beside it are fine. Reading
 * strings from a live English branch instead keeps the site in one language,
 * whichever branch the characteristics came from.
 *
 * The test branch is still consulted for keys the live one does not have, which
 * is exactly the vocabulary a test build introduces (see `loadPo`). So a new
 * vehicle's name survives, in Russian, rather than disappearing.
 */
export const localizationBranchFor = (branch: WotSrcBranch): WotSrcBranch =>
  branch === WotSrcBranch.CT ? WotSrcBranch.EU : branch;

// The five playable vehicle classes, keyed by their raw WoT client tag. The tag
// is what appears in a vehicle's tag list, so the enum values are load-bearing,
// not cosmetic.
export enum WotSrcVehicleType {
  Heavy = "heavyTank",
  Medium = "mediumTank",
  Light = "lightTank",
  TankDestroyer = "AT-SPG",
  SPG = "SPG",
}

// Membership set used to pick a vehicle's class out of its tag list. Anything
// not in here (bots, equipment carriers) is filtered out of the catalogue.
export const VEHICLE_TYPES = new Set<string>(Object.values(WotSrcVehicleType));

// Encode a WoT `tank_id` from the nation index (bits 4-7) and the per-nation
// local id (bits 8+). The trailing `1` is the vehicle `inNationID` flag WG sets
// on every tank. Mirrors the client's own id packing.
export function computeTankId(nationIdx: number, localId: number): number {
  return (localId << 8) | (nationIdx << 4) | 1;
}
