// Reading the client's XML once it has been parsed.
//
// The parser hands back plain objects whose leaves are whatever the file
// happened to contain: a number, a string with a comment glued to it, a list
// separated by spaces, or another object. Everything that turns one of those
// into a value the catalogue can use lives here, so a reader of a vehicle, a
// gun or a shell reaches for the same five functions rather than each writing
// its own tolerant parse.
//
// Its own file rather than the resource's, because half the specification
// modules need these and importing them from the resource made a cycle: the
// resource re-exports those modules, so two of them carried a private copy of
// `isObject` to stay out of it.

export type XmlNode = Record<string, unknown>;


export function isObject(v: unknown): v is XmlNode {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * WoT XML leaves that carry a `<!--BW_String-->` comment are parsed as their
 * text value (comments are stripped by the parser config), so most numeric
 * leaves are plain strings. Some, however, are objects wrapping a `#text` (when
 * a leaf also has child elements). Read either shape as a number.
 */
export function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (isObject(v) && "#text" in v) return num((v as XmlNode)["#text"]);
  return null;
}

/** All whitespace-separated tokens of a string leaf, as numbers. */
export function numList(v: unknown): number[] {
  if (v == null) return [];
  const s = typeof v === "object" && isObject(v) && "#text" in v ? String(v["#text"]) : String(v);
  return s
    .trim()
    .split(/\s+/)
    .map((t) => Number.parseFloat(t))
    .filter((n) => Number.isFinite(n));
}

/** Whitespace-separated string tokens of a string leaf. */
export function tokens(v: unknown): string[] {
  if (v == null) return [];
  const s = typeof v === "object" && isObject(v) && "#text" in v ? String(v["#text"]) : String(v);
  return s.trim().split(/\s+/).filter(Boolean);
}

/** Deep-merge `override` onto `base`; scalar/array overrides win outright. */
function deepMerge(base: unknown, override: unknown): unknown {
  if (!isObject(base)) return override === undefined ? base : override;
  if (!isObject(override)) return override === undefined ? base : override;
  const out: XmlNode = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

/**
 * Module slots list their modules as child elements keyed by name; the LAST key
 * in document order is the TOP module. A `shared` sub-key (the container's own
 * marker, never a module) is skipped.
 */
export function moduleKeys(slot: unknown): string[] {
  if (!isObject(slot)) return [];
  return Object.keys(slot).filter((k) => k !== "shared");
}
export function topModuleKey(slot: unknown): string | null {
  const keys = moduleKeys(slot);
  return keys.length ? keys[keys.length - 1] : null;
}

/**
 * Resolve a module to its full definition. `inline` is the vehicle-file block
 * (may be the literal string `"shared"`, or a partial object of overrides).
 * `sharedDef` is the component-file definition (or undefined). The result is a
 * deep-merge with vehicle-inline fields winning.
 */
export function resolveModule(inline: unknown, sharedDef: unknown): XmlNode | null {
  const inlineObj = isObject(inline) ? inline : {};
  if (sharedDef === undefined) return isObject(inline) ? inline : null;
  const merged = deepMerge(sharedDef, inlineObj);
  return isObject(merged) ? merged : null;
}
