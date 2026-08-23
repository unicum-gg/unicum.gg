import { loadPo } from "../localization";
import type { WotSrcBranch } from "../mirror";

/** A shell kind's display names, from WoT's own localization. */
export type ShellKind = {
  /** Short code, e.g. `AP`, `APCR`, `HEAT`. */
  short: string;
  /** Full name, e.g. `Armor-Piercing`, `High-Explosive Anti-Tank`. */
  name: string;
};

const cache = new Map<WotSrcBranch, Promise<Map<string, ShellKind>>>();

/**
 * The shell-kind names, read from WoT's `item_types.po`: the game keys them
 * `shell/kinds/<KIND>` (full name) and `shell/kindsAbbreviation/<KIND>` (short
 * code). Both come straight from the client rather than a hand-listed table, so
 * the set tracks WG (a new kind like `ARMOR_PIERCING_HE` appears on its own) and
 * the strings match the game exactly.
 *
 * Read through `loadPo`, which owns the rule about which branch a branch's
 * strings come from, so a client build extracted in another language still names
 * its shells in the site's one. `loadPo` memoizes the raw file, this memoizes
 * the handful of entries scanned out of it: the scan runs over every message in
 * `item_types.po` and is asked for once per vehicle per region by the warm
 * cron, which is thousands of full passes a day over three distinct results.
 *
 * The `shell/kinds/upperCase/<KIND>` variant is excluded by the `[A-Z_]+` match:
 * its key segment carries a slash.
 */
export function getShellKinds(
  branch: WotSrcBranch,
  fetchText: (url: string) => Promise<string>,
): Promise<Map<string, ShellKind>> {
  let pending = cache.get(branch);
  if (!pending) {
    pending = scanShellKinds(branch, fetchText);
    cache.set(branch, pending);
  }
  return pending;
}

async function scanShellKinds(
  branch: WotSrcBranch,
  fetchText: (url: string) => Promise<string>,
): Promise<Map<string, ShellKind>> {
  const po = await loadPo(branch, "item_types", fetchText);
  const names = new Map<string, string>();
  const shorts = new Map<string, string>();
  for (const [id, str] of po) {
    const m = /^shell\/(kinds|kindsAbbreviation)\/([A-Z_]+)$/.exec(id);
    if (!m) continue;
    (m[1] === "kinds" ? names : shorts).set(m[2], str);
  }
  const out = new Map<string, ShellKind>();
  for (const [kind, name] of names)
    out.set(kind, { short: shorts.get(kind) ?? name, name });
  return out;
}
