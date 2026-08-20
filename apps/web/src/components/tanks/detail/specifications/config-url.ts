import type { TankConfigModules } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import { VehicleModeKind } from "@unicum.gg/shared";

/** The module slots, in the order they are encoded in the URL. */
export const MODULE_SLOTS: (keyof TankConfigModules)[] = [
  "gun",
  "turret",
  "engine",
  "chassis",
  "radio",
];

/** The single query param the configurator owns: an opaque, self-contained token
 * that encodes the whole setup, so a shared URL stays short and clean
 * (`?setup=<token>`) instead of carrying a dozen readable params. */
export const SETUP_PARAM = "setup";

// URL-safe base64 of the compact inner query string. The token is opaque in the
// URL but fully client-decodable (no server storage): base64url so it needs no
// percent-encoding and survives copy/paste.
function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(token: string): string {
  return atob(token.replace(/-/g, "+").replace(/_/g, "/"));
}

/** The full configurator selection, ready to seed each hook. Every field is the
 * decoded, still-unvalidated intent from the URL; the hooks drop anything their
 * own data doesn't know (a stale share link stays harmless). */
export interface DecodedConfig {
  shell?: number;
  /** Module ids per `MODULE_SLOTS` (null = leave that slot at stock). */
  modules?: (number | null)[];
  /** Equipment key per slot (null = empty). */
  equipment?: (string | null)[];
  /** Chosen category per role slot, keyed by slot index. */
  roleCats?: Record<number, string>;
  /** Consumable key per slot (null = empty). */
  consumables?: (string | null)[];
  directives?: string[];
  fieldModLevel?: number;
  fieldModPairs?: Record<string, "first" | "second">;
  unlocked?: number[];
  /** Crew skills keyed `"<memberIndex>:<skillKey>"`. */
  crewSkills?: string[];
  /** Crew training level as a 0-1 fraction. */
  crewLevel?: number;
  /** The engaged driving mode (siege / rapid), or absent for travel. */
  mode?: VehicleModeKind;
}

/** The live selection to serialize. Defaults are omitted from the URL. */
export interface EncodeInput {
  shell: number;
  modules: (number | null)[];
  /** The modules the build opened on, which the URL leaves unwritten. It is the
   * stock configuration on a tank page and the top one in a comparison (see
   * `useTankBuild`), so an untouched vehicle produces no token at all in either
   * place, rather than a link full of module ids nobody chose. */
  defaultModules: (number | null)[];
  equipment: (string | null)[];
  roleCats: (string | null)[];
  slots: { role?: boolean }[];
  consumables: (string | null)[];
  directives: string[];
  fieldModLevel: number;
  fieldModPairs: Record<string, "first" | "second" | null>;
  unlocked: number[];
  crewSkills: string[];
  /** Crew training level as a 0-1 fraction. */
  crewLevel: number;
  /** The engaged driving mode, or null for travel (the default). */
  mode: VehicleModeKind | null;
}

const csv = (parts: (string | number | null)[]): string =>
  parts.map((p) => (p == null ? "" : String(p))).join(",");

// Single-letter inner keys keep the token as short as possible (it is opaque, so
// readability doesn't matter here, only length). Values are written raw (no
// percent-encoding) since they are code identifiers / numbers / `,`+`:` only,
// which base64 already hides and `URLSearchParams` parses back verbatim.
const K = {
  shell: "s",
  modules: "m",
  equipment: "e",
  slotCategory: "r",
  consumables: "c",
  directives: "d",
  fieldMods: "f",
  fieldModPairs: "p",
  upgrades: "u",
  crewSkills: "k",
  crewLevel: "l",
  mode: "g",
} as const;

/** Build the compact inner query string, writing only what differs from the
 * stock/empty defaults so a pristine config yields an empty string. */
function buildSetupString(input: EncodeInput): string {
  const parts: string[] = [];
  const add = (key: string, value: string) => parts.push(`${key}=${value}`);

  if (input.shell > 0) add(K.shell, String(input.shell));

  const modulesChanged = input.modules.some(
    (id, i) => id !== input.defaultModules[i],
  );
  if (modulesChanged) add(K.modules, csv(input.modules));

  if (input.equipment.some((k) => k != null))
    add(K.equipment, csv(input.equipment));

  const roleCats = input.slots
    .map((s, i) => (s.role && input.roleCats[i] ? `${i}:${input.roleCats[i]}` : null))
    .filter((v): v is string => v != null);
  if (roleCats.length) add(K.slotCategory, roleCats.join(","));

  if (input.consumables.some((k) => k != null))
    add(K.consumables, csv(input.consumables));

  if (input.directives.length) add(K.directives, input.directives.join(","));

  if (input.fieldModLevel > 0) {
    add(K.fieldMods, String(input.fieldModLevel));
    const pairs = Object.entries(input.fieldModPairs)
      .filter(([, side]) => side != null)
      .map(([key, side]) => `${key}:${side}`);
    if (pairs.length) add(K.fieldModPairs, pairs.join(","));
  }

  if (input.unlocked.length) add(K.upgrades, input.unlocked.join(","));

  if (input.crewSkills.length) add(K.crewSkills, input.crewSkills.join(","));

  const pct = Math.round(input.crewLevel * 100);
  if (pct !== 100) add(K.crewLevel, String(pct));

  if (input.mode) add(K.mode, input.mode);

  return parts.join("&");
}

/** Encode the current selection into the opaque `setup` token, or null when the
 * config is pristine (so the caller drops the param and keeps the URL clean). */
export function encodeSetup(input: EncodeInput): string | null {
  const qs = buildSetupString(input);
  return qs ? toBase64Url(qs) : null;
}

const splitCsv = (v: string | null): string[] =>
  v ? v.split(",") : [];
const parseKey = (v: string): string | null => (v === "" ? null : v);

/** Parse the compact inner params back into an intent object. Unknown/malformed
 * values are skipped rather than thrown, so an edited or outdated link degrades
 * to a partial (or empty) config instead of breaking the page. */
function decodeConfig(params: URLSearchParams): DecodedConfig {
  const out: DecodedConfig = {};

  const shell = Number(params.get(K.shell));
  if (Number.isInteger(shell) && shell > 0) out.shell = shell;

  const modules = params.get(K.modules);
  if (modules != null)
    out.modules = splitCsv(modules).map((v) => (v === "" ? null : Number(v)));

  const equipment = params.get(K.equipment);
  if (equipment != null) out.equipment = splitCsv(equipment).map(parseKey);

  const slotCategory = params.get(K.slotCategory);
  if (slotCategory != null) {
    const map: Record<number, string> = {};
    for (const entry of splitCsv(slotCategory)) {
      const [i, cat] = entry.split(":");
      if (cat) map[Number(i)] = cat;
    }
    out.roleCats = map;
  }

  const consumables = params.get(K.consumables);
  if (consumables != null) out.consumables = splitCsv(consumables).map(parseKey);

  const directives = params.get(K.directives);
  if (directives != null) out.directives = splitCsv(directives).filter(Boolean);

  const fieldMods = Number(params.get(K.fieldMods));
  if (Number.isInteger(fieldMods) && fieldMods > 0) out.fieldModLevel = fieldMods;

  const fieldModPairs = params.get(K.fieldModPairs);
  if (fieldModPairs != null) {
    const map: Record<string, "first" | "second"> = {};
    for (const entry of splitCsv(fieldModPairs)) {
      const [key, side] = entry.split(":");
      if (key && (side === "first" || side === "second")) map[key] = side;
    }
    out.fieldModPairs = map;
  }

  const upgrades = params.get(K.upgrades);
  if (upgrades != null)
    out.unlocked = splitCsv(upgrades)
      .map(Number)
      .filter((n) => Number.isInteger(n));

  const crewSkills = params.get(K.crewSkills);
  if (crewSkills != null)
    out.crewSkills = splitCsv(crewSkills).filter((v) => v.includes(":"));

  const crewLevel = Number(params.get(K.crewLevel));
  if (Number.isFinite(crewLevel) && crewLevel > 0 && crewLevel <= 100)
    out.crewLevel = crewLevel / 100;

  const mode = params.get(K.mode);
  if (mode === VehicleModeKind.Siege || mode === VehicleModeKind.Rapid)
    out.mode = mode;

  return out;
}

/** Decode a `setup` token (from the URL) back into a config intent. A missing or
 * malformed token yields an empty config rather than throwing. */
export function decodeSetup(token: string | null | undefined): DecodedConfig {
  if (!token) return {};
  try {
    return decodeConfig(new URLSearchParams(fromBase64Url(token)));
  } catch {
    return {};
  }
}

// A comparison carries one build per column in the same `setup` param, comma
// separated and index-aligned with the compared vehicles (an empty slot is a
// pristine column). Base64url never produces a comma, so the tokens can't be
// confused with the separator, and a single-vehicle page reads the first
// position as its own token unchanged.

/** Join per-column tokens into the shared `setup` value, or null when every
 * column is pristine (so the caller drops the param entirely). */
export function encodeSetups(tokens: (string | null)[]): string | null {
  if (!tokens.some(Boolean)) return null;
  // Trailing empty columns carry no information, so they're dropped.
  const last = tokens.reduce((n, t, i) => (t ? i : n), -1);
  return tokens
    .slice(0, last + 1)
    .map((t) => t ?? "")
    .join(",");
}

/** Split the shared `setup` value into one token per column, padded to `count`
 * so every column reads a defined slot. */
export function decodeSetups(
  value: string | null | undefined,
  count: number,
): (string | null)[] {
  const parts = value ? value.split(",") : [];
  return Array.from({ length: count }, (_, i) => parts[i] || null);
}
