import { BATTLE_TYPE_LABEL, BattleType } from "./battle-types";
import { MAP_CAMOUFLAGE_LABEL, MapCamouflage } from "./camouflage";
import { gameModeFromRaw, MAP_GAME_MODE_LABEL, MapGameMode } from "./game-modes";

/** What a recorded map change is about, so the reader can render each class the
 * way it deserves (a number inline, a mode as a badge, geometry on a minimap). */
export enum MapChangeKind {
  /** A number or a label: play area, battle timer, team size, camouflage. */
  Value = "value",
  /** A game mode the map gained or lost. */
  Mode = "mode",
  /** A battle type the map entered or left. */
  BattleType = "battleType",
  /** A random event the map gained or lost. */
  RandomEvent = "randomEvent",
  /** Markers that moved, appeared or disappeared, drawn on the minimap. */
  Geometry = "geometry",
  /** The map itself entering or leaving the client. */
  Presence = "presence",
}

/**
 * The field of the change that records the map entering or leaving the game.
 *
 * Kept in the same feed as the rest rather than in a lifecycle table of its own,
 * because a map's presence is not a one-time event the way a tank's release is:
 * the seasonal maps (the Lunar New Year reskins, the winter event arenas) leave
 * and come back every year, and a list of dated additions and removals is
 * exactly what a reader wants to see there.
 */
export const MAP_PRESENCE_FIELD = "presence";

/** How to display one tracked map value.
 *
 * `label` is the English wording and stays the fallback. `name` and `qualifier`
 * are what let a reader say the same thing in its own language: the label is
 * built here by gluing a noun to a mode in parentheses, and glued English is
 * the one thing a translation cannot take apart. So the pieces travel too,
 * and the app composes them with its own catalogues. Optional throughout: a
 * field with nothing to look up (a random event carries the event's own name)
 * simply has none.
 */
export type MapFieldDescriptor = {
  label: string;
  unit?: string;
  kind: MapChangeKind;
  /** What the change is about, as a key into the reader's field catalogue. */
  name?: MapFieldName;
  /** The mode or battle type the name is qualified by, as the client tokens the
   * game's own vocabulary is keyed on. */
  qualifier?: { mode?: string; battleType?: BattleType };
};

/** The things a map change can be about, as keys a reader translates. Modes,
 * battle types and random events are absent on purpose: those name themselves,
 * from the game's own vocabulary or from the event's own text. */
export type MapFieldName =
  | "width"
  | "height"
  | "round-length"
  | "team-size"
  | "camouflage"
  | "presence"
  | "variant-version"
  | "play-area"
  | "bases-team1"
  | "bases-team2"
  | "spawns-team1"
  | "spawns-team2"
  | "control-point"
  | "artillery-headquarters"
  | "comms-centers"
  | "observation-posts"
  | "points-of-interest";

/** A tracked scalar, keyed by its `MapSnapshotData` field. */
export type TrackedMapField = MapFieldDescriptor & {
  key: "roundLength" | "maxPlayersInTeam" | "widthMeters" | "heightMeters" | "camouflage";
};

/** Marks a change to a mode's markers (bases, spawns, control point, points of
 * interest) rather than to a scalar, in both the snapshot and `map_changes.field`. */
export const MAP_GEOMETRY_PREFIX = "geometry:";
/** Marks a game mode the map gained or lost. */
export const MAP_MODE_PREFIX = "mode:";
/** Marks a battle type the map entered or left. */
export const MAP_BATTLE_TYPE_PREFIX = "battleType:";
/** Marks a random event the map gained or lost, keyed by the event's name. */
export const MAP_RANDOM_EVENT_PREFIX = "randomEvent:";
/** Marks the play area of a mode that has one of its own (Onslaught is fought on
 * a reduced part of the map). */
export const MAP_PLAY_AREA_PREFIX = "playArea:";

/** The client's own token for Onslaught, which is how its geometry and play area
 * are keyed. */
export const ONSLAUGHT_MODE = "comp7";

/**
 * Marks a change recorded on one of a map's variant arenas, which the reader
 * shows on the base map's page.
 *
 * A variant is its own arena in the client, so its changes are recorded against
 * it and keyed exactly like any other map's. The base map is where a reader
 * looks for them, though, and there they have to say which of the two they
 * describe: without this, a moved Observation Post would read as a change to the
 * Onslaught everyone already plays, and the arena's own arrival would read as
 * the map itself being added to the game.
 *
 * The battle type rides in the key, so one prefix serves every variant and the
 * reader can name it ("Waffenträger", "Onslaught Night") without a second lookup.
 */
export const MAP_VARIANT_PREFIX = "variant:";

/** Re-key a change recorded on a folded variant arena for display on its base
 * map. Applied at read time: what was recorded stays a fact about the arena it
 * happened to. */
export function foldedMapChangeField(
  battleType: BattleType,
  field: string,
): string {
  return `${MAP_VARIANT_PREFIX}${battleType}:${field}`;
}

/** The battle type a re-keyed field belongs to, and the key underneath it. */
export function splitVariantField(
  key: string,
): { battleType: BattleType; field: string } | null {
  if (!key.startsWith(MAP_VARIANT_PREFIX)) return null;
  const rest = key.slice(MAP_VARIANT_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep === -1) return null;
  const battleType = rest.slice(0, sep);
  return battleType in BATTLE_TYPE_LABEL
    ? { battleType: battleType as BattleType, field: rest.slice(sep + 1) }
    : null;
}

/**
 * Which of a map's two play areas a change belongs to.
 *
 * Onslaught is not played on the map the other modes are: it has its own reduced
 * area, drawn from its own minimap image. A position that means one thing on one
 * of them means nothing on the other, so the reader has to keep them apart.
 */
/**
 * Which space a recorded change describes, as a key the reader groups by.
 *
 * A map has more than one: the ground the random modes are played on, the
 * reduced area Onslaught uses, and one per variant arena, each a different space
 * again. A position that means one thing on one of them means nothing on
 * another, so the reader has to keep them apart and draw each on its own image.
 *
 * Not an enum, because the variant areas are as open-ended as the battle types
 * are: a new kind of variant must not need a new member here.
 */
export type MapChangeArea = string;

/** The map itself, as the random modes are played on it. */
export const MAP_AREA_MAP: MapChangeArea = "map";
/** Onslaught's reduced area on the map's own arena. */
export const MAP_AREA_ONSLAUGHT: MapChangeArea = "onslaught";
/** One variant arena's own area. */
export const variantArea = (battleType: BattleType): MapChangeArea =>
  `${MAP_VARIANT_PREFIX}${battleType}`;

/** The play area a recorded change describes. */
export function mapChangeArea(key: string): MapChangeArea {
  const variant = splitVariantField(key);
  if (variant) return variantArea(variant.battleType);
  const onslaught =
    key === `${MAP_BATTLE_TYPE_PREFIX}${BattleType.Onslaught}` ||
    key.startsWith(`${MAP_PLAY_AREA_PREFIX}${ONSLAUGHT_MODE}`) ||
    key.startsWith(`${MAP_GEOMETRY_PREFIX}${ONSLAUGHT_MODE}:`);
  return onslaught ? MAP_AREA_ONSLAUGHT : MAP_AREA_MAP;
}

/**
 * The map properties whose changes across game versions are worth telling a
 * player about. Unlike a tank's characteristics, none of them is a buff or a
 * nerf: a longer battle timer or a wider play area changes how a map plays
 * without being an improvement, so map changes are never coloured.
 */
export const TRACKED_MAP_FIELDS: TrackedMapField[] = [
  { key: "widthMeters", label: "Play area width", unit: "m", kind: MapChangeKind.Value, name: "width" },
  { key: "heightMeters", label: "Play area height", unit: "m", kind: MapChangeKind.Value, name: "height" },
  { key: "roundLength", label: "Battle timer", unit: "s", kind: MapChangeKind.Value, name: "round-length" },
  { key: "maxPlayersInTeam", label: "Team size", kind: MapChangeKind.Value, name: "team-size" },
  { key: "camouflage", label: "Season", kind: MapChangeKind.Value, name: "camouflage" },
];

const BY_KEY = new Map(TRACKED_MAP_FIELDS.map((f) => [f.key as string, f]));

/** The marker family a geometry key describes, in the order a reader expects
 * them on the map. */
const GEOMETRY_LABELS: Record<string, { label: string; name: MapFieldName }> = {
  "bases:team1": { label: "Allied bases", name: "bases-team1" },
  "bases:team2": { label: "Enemy bases", name: "bases-team2" },
  "spawns:team1": { label: "Allied spawns", name: "spawns-team1" },
  "spawns:team2": { label: "Enemy spawns", name: "spawns-team2" },
  controlPoint: { label: "Control point", name: "control-point" },
  "pointsOfInterest:strike": { label: "Artillery Headquarters", name: "artillery-headquarters" },
  "pointsOfInterest:recon": { label: "Comms Centers", name: "comms-centers" },
  "pointsOfInterest:flare": { label: "Observation Posts", name: "observation-posts" },
  // Kept for the rows recorded before the two kinds were tracked apart.
  pointsOfInterest: { label: "Points of interest", name: "points-of-interest" },
};

/**
 * Turn a mode into a readable name, from either side of the wire: a surfaced
 * mode (`standard`), which is what a mode change records, or the raw client
 * token it came from (`ctf`, `comp7`, `epic`), which is what a geometry key
 * carries. The tokens the catalogue does not surface stay legible rather than
 * being dropped: a geometry change on a mode no page lists is still worth
 * reporting.
 */
export function mapModeLabel(token: string): string {
  const ref = resolveMapMode(token);
  if ("mode" in ref) return MAP_GAME_MODE_LABEL[ref.mode];
  if ("battleType" in ref) return BATTLE_TYPE_LABEL[ref.battleType];
  return ref.raw;
}

/**
 * What a mode token actually names, before anything renders it.
 *
 * A reader's language lives in the front's catalogues, not here, so the label
 * above is only the English end of this: the front resolves the same reference
 * against `game/vocabulary` and the battle types, which is what stops a
 * geometry change on `comp7` reading as "Onslaught" to a French reader. Both
 * ends therefore agree on what `ctf` means by construction rather than by
 * keeping two tables in step.
 *
 * `fallout` resolves to Steel Hunter for the reason `BATTLE_TYPE_LABEL` already
 * gives: it is the client's own id for that mode, and naming it after the token
 * left English as the one language calling it something the game never does.
 */
export function resolveMapMode(token: string): MapModeRef {
  if (token in MAP_GAME_MODE_LABEL) return { mode: token as MapGameMode };
  const mode = gameModeFromRaw(token);
  if (mode) return { mode };
  switch (token) {
    case ONSLAUGHT_MODE:
      return { battleType: BattleType.Onslaught };
    case "epic":
      return { battleType: BattleType.Frontline };
    case "ctf30x30":
    case "domination30x30":
      return { battleType: BattleType.GrandBattle };
    case "fallout":
      return { battleType: BattleType.BattleRoyale };
    default:
      return {
        raw: token.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      };
  }
}

/** A mode token resolved to what it names: a mode the catalogue surfaces, a
 * battle type, or a token neither knows, kept legible rather than dropped. */
export type MapModeRef =
  | { mode: MapGameMode }
  | { battleType: BattleType }
  | { raw: string };

function battleTypeLabel(value: string): string {
  return value in BATTLE_TYPE_LABEL
    ? BATTLE_TYPE_LABEL[value as BattleType]
    : value;
}

/**
 * Resolve a recorded `map_changes.field` key into how it should be displayed.
 *
 * Every key class the diff can produce goes through here, so the writer and the
 * reader can never disagree about what a key means.
 */
export function resolveMapChangeField(key: string): MapFieldDescriptor {
  const variant = splitVariantField(key);
  if (variant) {
    const name = BATTLE_TYPE_LABEL[variant.battleType];
    // The arena arriving is the map gaining a version of itself, not the map
    // arriving: said the other way it would be plainly false.
    if (variant.field === MAP_PRESENCE_FIELD) {
      return {
        label: `${name} version`,
        kind: MapChangeKind.Presence,
        name: "variant-version",
        qualifier: { battleType: variant.battleType },
      };
    }
    const base = resolveMapChangeField(variant.field);
    // A geometry or play-area label already names the mode it belongs to, so
    // the variant renames it rather than trailing a second parenthesis.
    const mode = base.label.match(/\(([^)]+)\)$/);
    return {
      ...base,
      label: mode
        ? base.label.replace(`(${mode[1]})`, `(${name})`)
        : `${base.label} (${name})`,
      // The variant replaces whatever mode the base named, so the qualifier is
      // the variant's battle type rather than the mode underneath it.
      qualifier: { battleType: variant.battleType },
    };
  }
  const scalar = BY_KEY.get(key);
  if (scalar) return scalar;
  if (key === MAP_PRESENCE_FIELD) {
    return { label: "In the game", kind: MapChangeKind.Presence, name: "presence" };
  }

  if (key.startsWith(MAP_MODE_PREFIX)) {
    const token = key.slice(MAP_MODE_PREFIX.length);
    return {
      label: mapModeLabel(token),
      kind: MapChangeKind.Mode,
      qualifier: { mode: token },
    };
  }
  if (key.startsWith(MAP_BATTLE_TYPE_PREFIX)) {
    const value = key.slice(MAP_BATTLE_TYPE_PREFIX.length);
    return {
      label: battleTypeLabel(value),
      kind: MapChangeKind.BattleType,
      qualifier:
        value in BATTLE_TYPE_LABEL
          ? { battleType: value as BattleType }
          : undefined,
    };
  }
  if (key.startsWith(MAP_RANDOM_EVENT_PREFIX)) {
    return {
      label: key.slice(MAP_RANDOM_EVENT_PREFIX.length),
      kind: MapChangeKind.RandomEvent,
    };
  }
  if (key.startsWith(MAP_PLAY_AREA_PREFIX)) {
    const token = key.slice(MAP_PLAY_AREA_PREFIX.length);
    return {
      label: `Play area (${mapModeLabel(token)})`,
      unit: "m",
      kind: MapChangeKind.Value,
      name: "play-area",
      qualifier: { mode: token },
    };
  }
  if (key.startsWith(MAP_GEOMETRY_PREFIX)) {
    const rest = key.slice(MAP_GEOMETRY_PREFIX.length);
    const sep = rest.indexOf(":");
    const token = sep === -1 ? rest : rest.slice(0, sep);
    const family = sep === -1 ? "" : rest.slice(sep + 1);
    const what = GEOMETRY_LABELS[family];
    return {
      label: `${what?.label ?? family} (${mapModeLabel(token)})`,
      kind: MapChangeKind.Geometry,
      name: what?.name,
      qualifier: { mode: token },
    };
  }
  return { label: key, kind: MapChangeKind.Value };
}

/** Display one side of a recorded change. Values are stored as the raw strings
 * the diff produced, so this only has to make them readable: the camouflage
 * token becomes a season, and a number takes its unit. */
export function displayMapValue(key: string, raw: string | null): string | null {
  if (raw === null) return null;
  if (key === "camouflage") {
    return raw in MAP_CAMOUFLAGE_LABEL
      ? MAP_CAMOUFLAGE_LABEL[raw as MapCamouflage]
      : raw;
  }
  const { unit } = resolveMapChangeField(key);
  return unit ? `${raw} ${unit}` : raw;
}
