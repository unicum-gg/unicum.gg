import { rawUrl, WotSrcBranch } from "../mirror";

/** A shell kind's display names, from WoT's own localization. */
export type ShellKind = {
  /** Short code, e.g. `AP`, `APCR`, `HEAT`. */
  short: string;
  /** Full name, e.g. `Armor-Piercing`, `High-Explosive Anti-Tank`. */
  name: string;
};

/**
 * Parse the shell-kind names out of WoT's `item_types.po` localization: the game
 * keys them `shell/kinds/<KIND>` (full name) and `shell/kindsAbbreviation/<KIND>`
 * (short code). Both are read straight from the client rather than hand-listed,
 * so the set tracks WG (new kinds like `ARMOR_PIERCING_HE` appear automatically)
 * and the strings match the game exactly. The `shell/kinds/upperCase/<KIND>`
 * variant is skipped (its key segment has a slash, so the `[A-Z_]+` kind match
 * excludes it).
 */
export function parseShellKinds(po: string): Map<string, ShellKind> {
  const names = new Map<string, string>();
  const shorts = new Map<string, string>();
  const lines = po.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const id = /^msgid "shell\/(kinds|kindsAbbreviation)\/([A-Z_]+)"$/.exec(
      lines[i].trim(),
    );
    if (!id) continue;
    const str = /^msgstr "(.*)"$/.exec(lines[i + 1].trim());
    if (!str) continue;
    (id[1] === "kinds" ? names : shorts).set(id[2], str[1]);
  }
  const out = new Map<string, ShellKind>();
  for (const [kind, name] of names)
    out.set(kind, { short: shorts.get(kind) ?? name, name });
  return out;
}

// `item_types.po` is a single shared file per client build (not per tank), so
// fetch + parse it once per branch and reuse across every tank's configs.
const cache = new Map<WotSrcBranch, Promise<Map<string, ShellKind>>>();

/**
 * The shell-kind name map for a branch, fetched and parsed once (memoized).
 * Fails open to an empty map, so a localization hiccup just drops the friendly
 * names and the caller falls back to the raw kind.
 */
export function getShellKinds(
  branch: WotSrcBranch,
  fetchText: (url: string) => Promise<string>,
): Promise<Map<string, ShellKind>> {
  let pending = cache.get(branch);
  if (!pending) {
    pending = fetchText(
      rawUrl(branch, "sources/res/text/lc_messages/item_types.po"),
    )
      .then(parseShellKinds)
      .catch(() => new Map<string, ShellKind>());
    cache.set(branch, pending);
  }
  return pending;
}
