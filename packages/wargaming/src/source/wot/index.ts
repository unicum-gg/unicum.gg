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

export const BRANCH_BY_REGION: Record<Region, WotSrcBranch> = {
  [Region.EU]: WotSrcBranch.EU,
  [Region.NA]: WotSrcBranch.NA,
  [Region.ASIA]: WotSrcBranch.ASIA,
};

// The five playable vehicle classes, keyed by their raw WoT client tag. The tag
// is what appears in a vehicle's tag list, so the enum values are load-bearing,
// not cosmetic.
export enum VehicleType {
  Heavy = "heavyTank",
  Medium = "mediumTank",
  Light = "lightTank",
  TankDestroyer = "AT-SPG",
  SPG = "SPG",
}

// Membership set used to pick a vehicle's class out of its tag list. Anything
// not in here (bots, equipment carriers) is filtered out of the catalogue.
export const VEHICLE_TYPES = new Set<string>(Object.values(VehicleType));

// Encode a WoT `tank_id` from the nation index (bits 4-7) and the per-nation
// local id (bits 8+). The trailing `1` is the vehicle `inNationID` flag WG sets
// on every tank. Mirrors the client's own id packing.
export function computeTankId(nationIdx: number, localId: number): number {
  return (localId << 8) | (nationIdx << 4) | 1;
}
