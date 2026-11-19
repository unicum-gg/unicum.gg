// Writes what the client's event packs declare, so a new event needs nothing
// written by hand:
//
// - `packages/shared/src/wot/event-modes.generated.ts`: every battle mode an
//   event pack adds, by the `bonusType` its battles carry, and every arena an
//   event names, with the map it replays when it is a version of one;
// - between the markers of `packages/shared/src/wot/maps/battle-types.ts`: a
//   `BattleType` per event whose arenas replay existing maps, so the map pages
//   show the event as a view of each map (`?view=black_signal`) rather than as
//   a card of its own named after a raw arena id.
//
// `BATTLE_MODE_LABEL` names the client's own modes by hand, which is right for
// them (their two enums do not share member names, `REGULAR` against `RANDOM`)
// and wrong for events, which arrive every few weeks: Black Signal (111) played
// for a week as an unnamed mode before anybody noticed. An event pack declares
// everything needed to name it (see `eventModesOf`), so the packs are found and
// read here instead, and a new event is named on the next build after the
// mirror carries it.
//
// The packs are found by listing the mirror (`event-packs`), plus one listing
// of each pack's common scripts to find its constants: about fifteen GitHub API
// calls a run, the files themselves are raw reads.
//
// Runs on `predev`/`prebuild`/`postinstall`. Any failure keeps the committed
// file, like the other generators reading the mirror: the table is a fallback
// behind the hand-kept one, and a stale copy only misses the newest event.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Deep paths, not the barrel: the barrel reaches the client, whose `env.ts`
// validates at import.
import { eventModesOf, type EventMode } from "@unicum.gg/wargaming/source/wot/event-modes";
import { parsePo } from "@unicum.gg/wargaming/source/wot/localization";
import { rawUrl } from "@unicum.gg/wargaming/source/wot/mirror";
import { manualVariantOf } from "@unicum.gg/shared/wot/maps/battle-types";
import { eventPacks, mirrorListing, PACKS_BRANCH, TEXT_DIR } from "./event-packs";

const SHARED = join(dirname(fileURLToPath(import.meta.url)), "../../../packages/shared/src/wot");
const OUT = join(SHARED, "event-modes.generated.ts");
const BATTLE_TYPES = join(SHARED, "maps/battle-types.ts");

/** One arena an event names. */
type EventArena = {
  id: string;
  /** The event's own English name for it. */
  name: string;
  /** The map it replays, when it is a version of one. */
  baseId?: string;
  /** The `BattleType` value of the event's view on that map. */
  battleType?: string;
};

/** A `BattleType` an event adds. */
type EventBattleType = { member: string; value: string; label: string };

/** A raw file, or "" when the branch does not have it. */
async function raw(path: string): Promise<string> {
  const response = await fetch(rawUrl(PACKS_BRANCH, path));
  if (response.status === 404) return "";
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}

async function modesOf(pack: string): Promise<EventMode[]> {
  const common = `sources/res/${pack}/scripts/common`;
  let files: string[];
  try {
    files = await mirrorListing(common, true);
  } catch (error) {
    // A pack with text and no common scripts (a UI-only feature) declares no
    // mode. Anything other than its absence is a failed read.
    if (error instanceof Error && error.message.includes("HTTP 404")) return [];
    throw error;
  }
  const constants = await Promise.all(
    files
      .filter((file) => /constants[^/]*\.py$/.test(file))
      .map((file) => raw(`${common}/${file}`)),
  );
  return eventModesOf(pack, constants, await raw(`${TEXT_DIR}/${pack}.menu.extend.po`));
}

/** Every arena id the client's own `arenas.po` names, with its English name. */
function namedArenas(po: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of parsePo(po)) {
    if (key.endsWith("/name") && value.trim()) out.set(key.slice(0, -"/name".length), value.trim());
  }
  return out;
}

/** The longest arena id `id` extends with `_<suffix>`, among `known`. */
function baseOf(id: string, known: Map<string, string>): string | undefined {
  for (let cut = id.lastIndexOf("_"); cut > 0; cut = id.lastIndexOf("_", cut - 1)) {
    if (known.has(id.slice(0, cut))) return id.slice(0, cut);
  }
  return undefined;
}

/**
 * The arenas one pack names, each tied to the map it replays when it is one.
 *
 * A version of a map is an arena whose id extends that map's and whose name IS
 * that map's: the event plays Pilsen, and calls it Pilsen. An arena the event
 * renamed (Halloween's `251_br_battle_city3_hw25`, "Babylon Anomaly") is a map
 * of its own and keeps its card. An arena the hand-written rules already fold
 * (Last Stand's `_ls26_*`) is left to them.
 */
function arenasOf(
  pack: string,
  po: string,
  known: Map<string, string>,
  type: EventBattleType | null,
): EventArena[] {
  return [...namedArenas(po)].map(([id, name]) => {
    const baseId = baseOf(id, known);
    const replays = baseId !== undefined && known.get(baseId) === name;
    return replays && type && !manualVariantOf(id)
      ? { id, name, baseId, battleType: type.value }
      : { id, name };
  });
}

/** The battle type an event's pack adds, named after the pack's own mode. */
function battleTypeOf(modes: EventMode[]): EventBattleType | null {
  // The pack's first mode, which is the plain one: a difficulty comes after it
  // under a later number ("Last Stand (Hard)").
  const [mode] = [...modes].sort((a, b) => a.bonusType - b.bonusType);
  if (!mode) return null;
  const words = mode.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  return {
    member: words.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(""),
    value: words.join("_").toLowerCase(),
    label: mode.name,
  };
}

function render(modes: EventMode[], arenas: EventArena[]): string {
  const rows = modes
    .map((mode) => `  ${mode.bonusType}: ${JSON.stringify(mode.name)}, // ${mode.pack}`)
    .join("\n");
  return `// Generated by apps/web/scripts/generate-event-modes.ts from the client's event
// packs. Do not edit: a mode named wrongly here is named wrongly by the client
// files, and a name to override belongs in \`BATTLE_MODE_LABEL\`, which wins.

/** What each event mode is called, by the \`bonusType\` its battles carry. */
export const EVENT_MODE_LABEL: Record<number, string> = {
${rows}
};

/**
 * Every arena an event names, by arena id: its English name, and for a version
 * of an existing map, that map and the \`BattleType\` of the event's view on it.
 */
export const EVENT_ARENAS: Record<
  string,
  { name: string; baseId?: string; battleType?: string }
> = {
${arenas
  .map(({ id, ...rest }) => `  ${JSON.stringify(id)}: ${JSON.stringify(rest)},`)
  .join("\n")}
};
`;
}

/** `text` with the lines between `// generated:<tag>` and `// end:<tag>` replaced. */
function between(text: string, tag: string, lines: string[]): string {
  const open = `// generated:${tag}\n`;
  const close = `// end:${tag}`;
  const start = text.indexOf(open);
  const end = text.indexOf(close);
  if (start < 0 || end < start) throw new Error(`battle-types.ts: no ${tag} markers`);
  const indent = text.slice(text.lastIndexOf("\n", start) + 1, start);
  const body = lines.map((line) => `${indent}${line}\n`).join("");
  return text.slice(0, start + open.length) + body + indent + text.slice(end);
}

/** Write a file only when it changes, saying whether it did. */
function write(path: string, next: string): boolean {
  let current = "";
  try {
    current = readFileSync(path, "utf-8");
  } catch {
    // First run.
  }
  if (current === next) return false;
  writeFileSync(path, next);
  return true;
}

async function main() {
  const packs = await eventPacks();
  const [byPack, known] = await Promise.all([
    Promise.all(packs.map(async (pack) => ({ pack, modes: await modesOf(pack) }))),
    raw(`${TEXT_DIR}/arenas.po`).then(namedArenas),
  ]);
  const modes = byPack.flatMap(({ modes }) => modes);
  if (modes.length === 0) throw new Error("no pack declared a mode");
  if (known.size === 0) throw new Error("arenas.po named no arena");

  const types: EventBattleType[] = [];
  const arenas: EventArena[] = [];
  for (const { pack, modes: own } of byPack) {
    const type = battleTypeOf(own);
    const named = arenasOf(pack, await raw(`${TEXT_DIR}/${pack}.arenas.extend.po`), known, type);
    arenas.push(...named);
    // A type only for an event with a map to show it on.
    if (type && named.some((arena) => arena.battleType === type.value)) types.push(type);
  }
  arenas.sort((a, b) => a.id.localeCompare(b.id));

  const wroteData = write(
    OUT,
    render(modes.sort((a, b) => a.bonusType - b.bonusType), arenas),
  );
  let battleTypes = readFileSync(BATTLE_TYPES, "utf-8");
  battleTypes = between(
    battleTypes,
    "event-battle-types",
    types.map((type) => `${type.member} = ${JSON.stringify(type.value)},`),
  );
  battleTypes = between(
    battleTypes,
    "event-battle-type-labels",
    types.map((type) => `[BattleType.${type.member}]: ${JSON.stringify(type.label)},`),
  );
  const wroteTypes = write(BATTLE_TYPES, battleTypes);

  if (!wroteData && !wroteTypes) {
    console.log(`[event-modes] up to date (${modes.length} mode(s), ${types.length} map view(s))`);
    return;
  }
  console.log(
    `[event-modes] ${modes.length} mode(s) from ${packs.length} pack(s): ${modes
      .map((mode) => `${mode.bonusType} ${mode.name}`)
      .join(", ")}; map views: ${
      types.map((type) => `${type.label} on ${arenas.filter((a) => a.battleType === type.value).map((a) => a.baseId).join(", ")}`).join("; ") || "none"
    }`,
  );
}

main().catch((error) => {
  console.warn(
    `[event-modes] could not read the mirror (${error instanceof Error ? error.message : error}), keeping the committed file`,
  );
});
