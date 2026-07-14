import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { rawUrl, WotSrcBranch } from "./mirror";

// The canonical nation order is WG's own `nations.NAMES` tuple, mirrored in the
// wot-src client scripts. The array INDEX is the nation's encoded value inside a
// `tank_id` (bits 4-7), so this order is load-bearing, not cosmetic. Deriving it
// from source means a new WoT nation is picked up automatically, with the right
// tank_id encoding, instead of needing a hand-maintained list in every fetcher.
const nationsUrl = (branch: WotSrcBranch) =>
  rawUrl(branch, "sources/res/scripts/common/nations.py");

// Fail-soft fallback: if the fetch/parse ever breaks, degrade to the last known
// order rather than cataloguing zero tanks (WG/G-Core hiccups are normal ops).
// The live parse is the source of truth; this only guards the fetch failing.
const FALLBACK_NATIONS = [
  "ussr", "germany", "usa", "china", "france", "uk",
  "japan", "czech", "sweden", "poland", "italy",
] as const;

/** Parse the `NAMES = ('ussr', 'germany', …)` tuple out of `nations.py`. */
export function parseNationNames(py: string): string[] {
  // `\b` so we hit the standalone `NAMES`, never `AVAILABLE_NAMES`.
  const tuple = py.match(/\bNAMES\s*=\s*\(([^)]*)\)/);
  if (!tuple) return [];
  return [...tuple[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/**
 * The ordered nation list for a wot-src branch, derived from the game's own
 * `nations.py`. The array index is each nation's `tank_id` encoding value, so
 * callers can keep using `computeTankId(index, localId)` unchanged.
 */
export async function fetchNations(
  t: Transport,
  branch: WotSrcBranch,
): Promise<readonly string[]> {
  try {
    const res = await t.get(new URL(nationsUrl(branch)), { limit: RateLimit.None });
    const names = parseNationNames(await res.text());
    return names.length > 0 ? names : FALLBACK_NATIONS;
  } catch {
    return FALLBACK_NATIONS;
  }
}
