import type { TankConfig, TankConfigModules } from "@unicum.gg/core/wargaming/wot/tanks/configs";

/** The module slots, in the order they are encoded in the URL. */
export const MODULE_SLOTS: (keyof TankConfigModules)[] = [
  "gun",
  "turret",
  "engine",
  "chassis",
  "radio",
];

/** The query-param keys the configurator owns, so a URL update can clear its own
 * params without touching anything else on the page. */
export const CONFIG_PARAM_KEYS = [
  "shell",
  "modules",
  "equipment",
  "slotCategory",
  "consumables",
  "directives",
  "fieldMods",
  "fieldModPairs",
  "upgrades",
  "crewSkills",
  "crewLevel",
] as const;

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
}

/** The live selection to serialize. Defaults are omitted from the URL. */
export interface EncodeInput {
  shell: number;
  modules: (number | null)[];
  stockModules: (number | null)[];
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
}

const csv = (parts: (string | number | null)[]): string =>
  parts.map((p) => (p == null ? "" : String(p))).join(",");

/** Serialize the current selection into a `URLSearchParams`, writing only the
 * params that differ from the stock/empty defaults so a pristine config yields an
 * empty query. Existing non-config params are preserved by the caller. */
export function encodeConfig(
  input: EncodeInput,
  base: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of CONFIG_PARAM_KEYS) params.delete(key);

  if (input.shell > 0) params.set("shell", String(input.shell));

  const modulesChanged = input.modules.some(
    (id, i) => id !== input.stockModules[i],
  );
  if (modulesChanged) params.set("modules", csv(input.modules));

  if (input.equipment.some((k) => k != null))
    params.set("equipment", csv(input.equipment));

  const roleCats = input.slots
    .map((s, i) => (s.role && input.roleCats[i] ? `${i}:${input.roleCats[i]}` : null))
    .filter((v): v is string => v != null);
  if (roleCats.length) params.set("slotCategory", roleCats.join(","));

  if (input.consumables.some((k) => k != null))
    params.set("consumables", csv(input.consumables));

  if (input.directives.length)
    params.set("directives", input.directives.join(","));

  if (input.fieldModLevel > 0) {
    params.set("fieldMods", String(input.fieldModLevel));
    const pairs = Object.entries(input.fieldModPairs)
      .filter(([, side]) => side != null)
      .map(([key, side]) => `${key}:${side}`);
    if (pairs.length) params.set("fieldModPairs", pairs.join(","));
  }

  if (input.unlocked.length) params.set("upgrades", input.unlocked.join(","));

  if (input.crewSkills.length)
    params.set("crewSkills", input.crewSkills.join(","));

  const pct = Math.round(input.crewLevel * 100);
  if (pct !== 100) params.set("crewLevel", String(pct));

  return params;
}

const splitCsv = (v: string | null): string[] =>
  v ? v.split(",") : [];
const parseKey = (v: string): string | null => (v === "" ? null : v);

/** Parse the configurator params back into an intent object. Unknown/malformed
 * values are skipped rather than thrown, so an edited or outdated link degrades
 * to a partial (or empty) config instead of breaking the page. */
export function decodeConfig(params: URLSearchParams): DecodedConfig {
  const out: DecodedConfig = {};

  const shell = Number(params.get("shell"));
  if (Number.isInteger(shell) && shell > 0) out.shell = shell;

  const modules = params.get("modules");
  if (modules != null)
    out.modules = splitCsv(modules).map((v) => (v === "" ? null : Number(v)));

  const equipment = params.get("equipment");
  if (equipment != null) out.equipment = splitCsv(equipment).map(parseKey);

  const slotCategory = params.get("slotCategory");
  if (slotCategory != null) {
    const map: Record<number, string> = {};
    for (const entry of splitCsv(slotCategory)) {
      const [i, cat] = entry.split(":");
      if (cat) map[Number(i)] = cat;
    }
    out.roleCats = map;
  }

  const consumables = params.get("consumables");
  if (consumables != null) out.consumables = splitCsv(consumables).map(parseKey);

  const directives = params.get("directives");
  if (directives != null) out.directives = splitCsv(directives).filter(Boolean);

  const fieldMods = Number(params.get("fieldMods"));
  if (Number.isInteger(fieldMods) && fieldMods > 0) out.fieldModLevel = fieldMods;

  const fieldModPairs = params.get("fieldModPairs");
  if (fieldModPairs != null) {
    const map: Record<string, "first" | "second"> = {};
    for (const entry of splitCsv(fieldModPairs)) {
      const [key, side] = entry.split(":");
      if (key && (side === "first" || side === "second")) map[key] = side;
    }
    out.fieldModPairs = map;
  }

  const upgrades = params.get("upgrades");
  if (upgrades != null)
    out.unlocked = splitCsv(upgrades)
      .map(Number)
      .filter((n) => Number.isInteger(n));

  const crewSkills = params.get("crewSkills");
  if (crewSkills != null)
    out.crewSkills = splitCsv(crewSkills).filter((v) => v.includes(":"));

  const crewLevel = Number(params.get("crewLevel"));
  if (Number.isFinite(crewLevel) && crewLevel > 0 && crewLevel <= 100)
    out.crewLevel = crewLevel / 100;

  return out;
}

/** Find the config index that mounts the requested module ids (every specified
 * slot must match), falling back to the stock index for an unknown combination. */
export function resolveModuleIdx(
  configs: TankConfig[],
  ids: (number | null)[] | undefined,
  stockIdx: number,
): number {
  if (!ids) return stockIdx;
  let best = -1;
  let bestScore = -1;
  configs.forEach((c, i) => {
    let score = 0;
    let ok = true;
    MODULE_SLOTS.forEach((slot, si) => {
      const want = ids[si];
      if (want == null) return;
      if (c.modules[slot] === want) score += 1;
      else ok = false;
    });
    if (ok && score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best >= 0 ? best : stockIdx;
}
