import type { ArenaMinimapLayer } from "@unicum.gg/wargaming";
import { minimapLayerUrl } from "./minimap";

/** One random event a map can run mid-battle: a plane or an airship coming down,
 * a train derailing, a district being bombed. It is a chance, not a certainty,
 * and it fires at most once in a battle. The game paints the area it will strike
 * on the minimap, then redraws that patch of the map once it has, so an event is
 * those two sets of art. A map can carry several. */
export type MapRandomEvent = {
  /** Slug derived from the event's layer names, e.g. `airship-crash-01`. */
  id: string;
  /** Display name, e.g. "Airship Crash". */
  name: string;
  /** The danger areas, as the minimap marks them before the event. Empty on the
   * maps that ship only the aftermath art. */
  zoneUrls: string[];
  /** The map once the event has struck: one patch per area it redraws. */
  afterUrls: string[];
};

// Words that say what a layer *is* rather than which event it belongs to, so two
// layers of one event agree once they are removed. `danger` only ever qualifies
// a zone, and `part`/`lower`/`upper` split one event's art across the separate
// areas it hits (Himmelsdorf's train derails along two stretches of track).
const ROLE_TOKENS = new Set([
  "mmap",
  "zone",
  "destroyed",
  "danger",
  "part",
  "lower",
  "upper",
]);

// The action half of an event's name. The client writes these either way round
// (`crash01_airship` beside `airship_crash01_destroyed`), so moving them last
// reads as English whichever order the layer used.
const ACTION_TOKENS = new Set([
  "crash",
  "crashing",
  "bombing",
  "destruction",
  "explosion",
]);

/** Split a layer file name into lowercase words: underscores, camelCase humps
 * and digit runs all separate (`mmap_bigCityBombing_danger_zone` ->
 * `big city bombing danger zone`, `crash01` -> `crash 01`). */
function tokenize(basename: string): string[] {
  return basename
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

/** The layer file's basename, e.g.
 * `spaces/04_himmelsdorf/mmap_crash01_airship_zone.dds` ->
 * `mmap_crash01_airship_zone`. */
function basenameOf(path: string): string {
  return path.split("/").pop()?.replace(/\.dds$/i, "") ?? "";
}

function titleCase(words: string[]): string {
  return words
    .map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Name an event from its identifying words: the action last ("crash airship" ->
 * "Airship Crash"), the ordinal dropped (it disambiguates two events of the same
 * kind, which `nameEvents` re-adds only when there is a clash). With nothing but
 * actions to go on (Pilsen's `crash01_bombing`) the last one alone reads best. */
function eventName(words: string[]): string {
  const named = words.filter((w) => !/^\d+$/.test(w));
  const actions = named.filter((w) => ACTION_TOKENS.has(w));
  const subject = named.filter((w) => !ACTION_TOKENS.has(w));
  if (subject.length === 0) {
    return actions.length > 0 ? titleCase(actions.slice(-1)) : "";
  }
  return titleCase([...subject, ...actions]);
}

type Group = {
  words: string[];
  zoneUrls: string[];
  afterUrls: string[];
};

/** True when `a` is a less specific naming of `b`: every word of `a` is in `b`,
 * `b` says more, and `a` says what the event is about rather than only what
 * happens to it. Cliff labels the same lighthouse collapse `lighthouse_crash_01`
 * on one layer and `lighthouse_plane_crash_01` on the other, and only the
 * inclusion tells us it is one event rather than two.
 *
 * The subject is what keeps the rule from over-merging. Inclusion alone is
 * vacuously true for a layer named after nothing but its role (`mmap_zone`),
 * which would swallow every other event on the map into it, and a layer named
 * after nothing but its action (`crash`) would merge an airship crash with a
 * train one. */
function narrowerThan(a: string[], b: string[]): boolean {
  if (a.length >= b.length) return false;
  const hasSubject = a.some((w) => !ACTION_TOKENS.has(w) && !/^\d+$/.test(w));
  return hasSubject && a.every((w) => b.includes(w));
}

/** The two layers of one event, named the same way. Pilsen writes
 * `crash01_bombing_zone` beside `crash01_bombing_destroyed`: nothing but the
 * role word separates them, so they match here rather than through the
 * inclusion rule above, which asks for a subject those names do not have. */
function sameWords(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((w) => b.includes(w));
}

/** Whether two layers name the same event, either identically or with one
 * naming it less specifically than the other. */
function sameEvent(a: string[], b: string[]): boolean {
  return sameWords(a, b) || narrowerThan(a, b) || narrowerThan(b, a);
}

/** Group the arena's minimap layers into events. Layers whose identifying words
 * match (or are covered by) another's belong to the same event, in the order the
 * arena_def lists them. */
function groupLayers(arenaId: string, layers: ArenaMinimapLayer[]): Group[] {
  const groups: Group[] = [];
  for (const layer of layers) {
    const basename = basenameOf(layer.path);
    if (!basename.startsWith("mmap_")) continue; // the standard minimap itself
    const tokens = tokenize(basename);
    const words = tokens.filter((t) => !ROLE_TOKENS.has(t));
    const url = minimapLayerUrl(arenaId, basename);
    const isZone = tokens.includes("zone");
    const existing = groups.find((g) => sameEvent(words, g.words));
    const group = existing ?? { words, zoneUrls: [], afterUrls: [] };
    if (!existing) groups.push(group);
    // Keep the shorter wording as the group's name: it is the one without the
    // extra qualifier, so it reads as the event rather than as one of its parts.
    else if (words.length < group.words.length) group.words = words;
    // A layer that does not mark a zone draws the map as the event left it: the
    // client names those `_destroyed`, and the handful that carry no role word
    // at all (Cliff) are terrain patches too.
    (isZone ? group.zoneUrls : group.afterUrls).push(url);
  }
  return groups;
}

/** The event's subject, ordinals dropped: what two layers agree on when only an
 * index tells them apart. */
function subjectOf(words: string[]): string {
  return words
    .filter((w) => !/^\d+$/.test(w))
    .sort()
    .join(" ");
}

/**
 * Reunite an event the client split across two ordinals.
 *
 * A group carrying only danger areas and a group of the same subject carrying
 * only aftermath art are the two halves of one event: Himmelsdorf shipped its
 * derailment as `crash02` zones beside a `crash01` aftermath until 1.24.1
 * renamed the file, and reading that as one event ending and another starting
 * would put a change in the history where the game had none.
 *
 * It cannot swallow two genuinely separate events: those each carry both halves
 * (Redshire crashes an airship twice, `airshipCrash_01` and `_02`, both with a
 * zone and an aftermath), and a complete group never merges.
 */
function mergeHalves(groups: Group[]): Group[] {
  const out: Group[] = [];
  for (const group of groups) {
    const complete = group.zoneUrls.length > 0 && group.afterUrls.length > 0;
    const other = complete
      ? undefined
      : out.find(
          (o) =>
            subjectOf(o.words) === subjectOf(group.words) &&
            (o.zoneUrls.length === 0) !== (group.zoneUrls.length === 0) &&
            (o.afterUrls.length === 0) !== (group.afterUrls.length === 0),
        );
    if (!other) {
      out.push(group);
      continue;
    }
    // The half that marks the zone names the event: it is the one the game shows
    // before anything happens.
    if (group.zoneUrls.length > 0) other.words = group.words;
    other.zoneUrls.push(...group.zoneUrls);
    other.afterUrls.push(...group.afterUrls);
  }
  return out;
}

/** Fill in display names, numbering only the events a map would otherwise show
 * twice (Redshire crashes an airship in two different places). */
function nameEvents(groups: Group[]): { name: string; id: string }[] {
  const named = groups.map((g) => eventName(g.words));
  const counts = new Map<string, number>();
  for (const n of named) counts.set(n, (counts.get(n) ?? 0) + 1);
  const seen = new Map<string, number>();
  return named.map((n, i) => {
    const index = (seen.get(n) ?? 0) + 1;
    seen.set(n, index);
    const name =
      n === ""
        ? `Random Event ${index}`
        : (counts.get(n) ?? 0) > 1
          ? `${n} ${index}`
          : n;
    // An event whose layers name nothing but an ordinal (a scripted scenario
    // demolition rather than a named crash) still needs a stable handle.
    const words = groups[i].words.filter((w) => !/^\d+$/.test(w));
    const id =
      words.length > 0 ? groups[i].words.join("-") : `random-event-${index}`;
    return { name, id };
  });
}

/** Whether the arena ships any event layer at all, without deriving the events
 * themselves. The gallery only needs the flag, and it is one test per map rather
 * than a tokenize/group/name pass over every layer. */
export function hasRandomEventLayers(
  layers: ArenaMinimapLayer[] | undefined,
): boolean {
  return (layers ?? []).some((l) => basenameOf(l.path).startsWith("mmap_"));
}

/**
 * The random events a map can run mid-battle, derived from the alternate
 * minimaps it ships (`<minimapLayers>`): one set of art marking where an event
 * strikes, one showing the ground it leaves behind.
 *
 * Empty for every map without them, which is how a caller tells a "Map With
 * Random Events" from an ordinary one.
 */
export function buildRandomEvents(
  arenaId: string,
  layers: ArenaMinimapLayer[] | undefined,
): MapRandomEvent[] {
  const groups = mergeHalves(groupLayers(arenaId, layers ?? []));
  const names = nameEvents(groups);
  return groups.map((g, i) => ({
    id: names[i].id,
    name: names[i].name,
    zoneUrls: g.zoneUrls,
    afterUrls: g.afterUrls,
  }));
}
