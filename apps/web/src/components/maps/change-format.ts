import {
  displayMapValue,
  MAP_NIGHT_PREFIX,
  MAP_PRESENT,
  MapChangeKind,
  parseMarkers,
  resolveMapChangeField,
  type MapHistoryPoint,
} from "@unicum.gg/shared";

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
  label: string,
  kind: MapChangeKind,
  gained: boolean,
  field: string,
  pending: boolean,
) {
  switch (kind) {
    case MapChangeKind.Presence:
      // The night arena arriving is the map gaining a version of itself, so it
      // says so rather than claiming the map entered the game.
      if (field.startsWith(MAP_NIGHT_PREFIX)) {
        return gained ? `${label} added` : `${label} removed`;
      }
      // Inside the Common Test block nothing has reached a live server yet, so
      // "added to the game" would contradict the block it sits in.
      if (pending) {
        return gained
          ? "Added on the test client"
          : "Removed on the test client";
      }
      return gained ? "Added to the game" : "Removed from the game";
    case MapChangeKind.Mode:
      return gained ? `${label} mode added` : `${label} mode removed`;
    case MapChangeKind.BattleType:
      return gained ? `Now played in ${label}` : `No longer played in ${label}`;
    case MapChangeKind.RandomEvent:
      return gained
        ? `${label} can now happen mid-battle`
        : `${label} no longer happens`;
    default:
      return gained ? `${label} added` : `${label} removed`;
  }
}

function markerSummary(
  label: string,
  before: MapHistoryPoint[],
  after: MapHistoryPoint[],
): string {
  if (before.length === 0) return `${label} added`;
  if (after.length === 0) return `${label} removed`;
  if (before.length !== after.length) {
    return `${label}: ${before.length} → ${after.length}`;
  }
  return `${label} moved`;
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
): FormattedMapChange {
  const meta = resolveMapChangeField(field);
  const base = { field, label: meta.label, kind: meta.kind };

  if (meta.kind === MapChangeKind.Geometry) {
    const markers = { before: parseMarkers(previous), after: parseMarkers(next) };
    return {
      ...base,
      before: null,
      after: null,
      markers,
      summary: markerSummary(meta.label, markers.before, markers.after),
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
      summary: presenceSummary(
        meta.label,
        meta.kind,
        next !== null,
        field,
        pending,
      ),
    };
  }

  return {
    ...base,
    before,
    after,
    markers: null,
    summary:
      before && after
        ? `${meta.label}: ${before} → ${after}`
        : after
          ? `${meta.label}: ${after}`
          : `${meta.label} removed`,
  };
}
