import type { TranslateFunction } from "@onruntime/translations";
import { battleTypeName, mapModeName } from "@/components/game-name";
import {
  displayMapValue,
  MAP_VARIANT_PREFIX,
  MAP_PRESENT,
  MapChangeKind,
  parseMarkers,
  resolveMapChangeField,
  type MapFieldDescriptor,
  type MapHistoryPoint,
} from "@unicum.gg/shared";

/**
 * The catalogues a change is worded from.
 *
 * Two, because the two halves have different authors: what a change is ABOUT is
 * ours (`t`), and the mode or battle type it belongs to is the game's own word
 * (`tGame`). A French reader sees "Postes d'observation (Offensive)", where the
 * second half is what Wargaming calls it and the first is what we call it.
 */
export type MapChangeWording = { t: TranslateFunction; tGame: TranslateFunction };

/** What a change is about, in the reader's language, with the mode it belongs
 * to when the name alone would be ambiguous. `label` stays the fallback: a key
 * the catalogue does not carry (a random event, an unlisted mode) is named by
 * the English the resolver built. */
function fieldName(meta: MapFieldDescriptor, w: MapChangeWording): string {
  const mode = meta.qualifier?.mode;
  const battleType = meta.qualifier?.battleType;
  const qualifier = battleType
    ? battleTypeName(battleType, w.tGame)
    : mode
      ? mapModeName(mode, w.tGame)
      : null;
  // A mode or a battle type IS its own name, so the qualifier beside it is the
  // same word twice ("Random (Aléatoire)"): the English label is what the
  // resolver built and the qualifier is what the reader reads, so only the
  // second belongs on the page.
  if (
    qualifier &&
    (meta.kind === MapChangeKind.Mode || meta.kind === MapChangeKind.BattleType)
  )
    return qualifier.startsWith("battle-types.") || qualifier.startsWith("map-modes.")
      ? meta.label
      : qualifier;

  const named = meta.name ? w.t(`field.${meta.name}`) : meta.label;
  // A key the catalogue answers with itself has no translation; the English the
  // resolver built is better than the key.
  const base = meta.name && named === `field.${meta.name}` ? meta.label : named;

  if (!qualifier) return base;
  // The variant version names its own battle type inside the string.
  if (meta.name === "variant-version") return w.t("field.variant-version", { type: qualifier });
  // A mode the game does not name resolves to its own key, which is worse than
  // saying nothing: the base label already carried the English in parentheses.
  const unresolved =
    qualifier.startsWith("battle-types.") || qualifier.startsWith("map-modes.");
  if (unresolved) return meta.label;
  return w.t("name-with-mode", { name: base, mode: qualifier });
}

/** A single map change, ready to render. Shared by the per-map history panel and
 * the global changes feed so both read a change the same way.
 *
 * Map changes carry no buff/nerf direction: a wider play area or a longer battle
 * timer changes how a map plays without being an improvement, so nothing here is
 * coloured. What varies instead is the shape of the change, which is what `kind`
 * is for.
 */
export type FormattedMapChange = {
  /** The raw field key. Unique within a map/version, unlike `label`, so it is
   * the safe React key. */
  field: string;
  label: string;
  kind: MapChangeKind;
  /** Displayed before/after values, null when the property did not exist then. */
  before: string | null;
  after: string | null;
  /** The marker positions of a geometry change, in metres from the play area's
   * bottom-left corner, for the before/after overlay. */
  markers: { before: MapHistoryPoint[]; after: MapHistoryPoint[] } | null;
  /** One line stating the change, for the feed and for screen readers. */
  summary: string;
};

/** "gained"/"lost" phrasing for the properties that are simply there or not. */
function presenceSummary(
  name: string,
  kind: MapChangeKind,
  gained: boolean,
  field: string,
  pending: boolean,
  w: MapChangeWording,
) {
  const say = (key: string) => w.t(`summary.${key}`, { name });
  switch (kind) {
    case MapChangeKind.Presence:
      // The night arena arriving is the map gaining a version of itself, so it
      // says so rather than claiming the map entered the game.
      if (field.startsWith(MAP_VARIANT_PREFIX)) {
        return say(gained ? "added" : "removed");
      }
      // Inside the Common Test block nothing has reached a live server yet, so
      // "added to the game" would contradict the block it sits in.
      if (pending) {
        return say(gained ? "added-on-test" : "removed-on-test");
      }
      return say(gained ? "added-to-game" : "removed-from-game");
    case MapChangeKind.Mode:
      return say(gained ? "mode-added" : "mode-removed");
    case MapChangeKind.BattleType:
      return say(gained ? "now-played-in" : "no-longer-played-in");
    case MapChangeKind.RandomEvent:
      return say(gained ? "event-added" : "event-removed");
    default:
      return say(gained ? "added" : "removed");
  }
}

function markerSummary(
  name: string,
  before: MapHistoryPoint[],
  after: MapHistoryPoint[],
  w: MapChangeWording,
): string {
  if (before.length === 0) return w.t("summary.added", { name });
  if (after.length === 0) return w.t("summary.removed", { name });
  if (before.length !== after.length) {
    return w.t("summary.count-changed", {
      name,
      before: before.length,
      after: after.length,
    });
  }
  return w.t("summary.moved", { name });
}

/**
 * Turn a recorded change (field key + before/after strings) into something a
 * page can render: a label, a readable value on each side, the parsed markers
 * when it is geometry, and a one-line summary.
 */
export function formatMapChange(
  field: string,
  previous: string | null,
  next: string | null,
  /** Whether the change is rendered in the Common Test block rather than in the
   * shipped history, which changes how a presence row reads. */
  pending = false,
  /** The catalogues the change is worded from. Optional so a caller with no
   * reader (a test, a script) still gets the English the resolver built. */
  wording?: MapChangeWording,
): FormattedMapChange {
  const meta = resolveMapChangeField(field);
  const w: MapChangeWording = wording ?? {
    t: ((k: string) => k) as TranslateFunction,
    tGame: ((k: string) => k) as TranslateFunction,
  };
  const name = wording ? fieldName(meta, w) : meta.label;
  const base = { field, label: name, kind: meta.kind };

  if (meta.kind === MapChangeKind.Geometry) {
    const markers = { before: parseMarkers(previous), after: parseMarkers(next) };
    return {
      ...base,
      before: null,
      after: null,
      markers,
      summary: markerSummary(name, markers.before, markers.after, w),
    };
  }

  const isPresence =
    previous === MAP_PRESENT || next === MAP_PRESENT || previous === null || next === null;
  const before = displayMapValue(field, previous);
  const after = displayMapValue(field, next);

  if (
    (meta.kind === MapChangeKind.Presence ||
      meta.kind === MapChangeKind.Mode ||
      meta.kind === MapChangeKind.BattleType ||
      meta.kind === MapChangeKind.RandomEvent) &&
    isPresence
  ) {
    return {
      ...base,
      before: null,
      after: null,
      markers: null,
      summary: presenceSummary(name, meta.kind, next !== null, field, pending, w),
    };
  }

  return {
    ...base,
    before,
    after,
    markers: null,
    summary:
      before && after
        ? w.t("summary.value-changed", { name, before, after })
        : after
          ? w.t("summary.value-set", { name, after })
          : w.t("summary.removed", { name }),
  };
}
