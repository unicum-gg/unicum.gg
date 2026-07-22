import { Region } from "../../region";

// Our own mirror of IzeBerg/wot-src (the WoT client scripts). We point at our
// fork rather than upstream so the catalogue depends only on infrastructure we
// control: the `unicum-gg/wot-src` branches are kept fast-forwarded to upstream
// by a scheduled sync, and if upstream ever goes private we keep serving the
// last synced state instead of breaking.
export const REPO = "unicum-gg/wot-src";

// The mirror branches we read: one per region client build. The mirror carries
// more branches (CT, RU, ...) but the catalogue only ever fetches these three.
export enum WotSrcBranch {
  EU = "EU",
  NA = "NA",
  ASIA = "ASIA",
}

/** Raw-content URL for `path` on `branch` of the wot-src mirror. */
export function rawUrl(branch: WotSrcBranch, path: string): string {
  return `https://raw.githubusercontent.com/${REPO}/${branch}/${path}`;
}

// The mirror's XML/PO files change only on a game patch. They are static between
// patches and heavily shared across tanks (the per-nation component files back
// every tank of that nation), so we cache each raw fetch for a day. Without this
// the shared files are re-fetched once per tank, turning a single tank page into
// ~9 GitHub-raw round trips. Passed as `cache` (ms) to `transport.getText`.
export const WOTSRC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const BRANCH_BY_REGION: Record<Region, WotSrcBranch> = {
  [Region.EU]: WotSrcBranch.EU,
  [Region.NA]: WotSrcBranch.NA,
  [Region.ASIA]: WotSrcBranch.ASIA,
};

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
