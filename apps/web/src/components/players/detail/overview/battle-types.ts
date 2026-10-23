import type { MapMarker } from "@unicum.gg/shared";
import type { BattleEconomy } from "@unicum.gg/shared";
import type { PlayerIdentity } from "@/components/entity/player-identity";

export type MapOverlay = {
  bounds: {
    bottomLeft: { x: number; z: number };
    upperRight: { x: number; z: number };
  };
  widthMeters: number;
  heightMeters: number;
  bases: { team1: MapMarker[]; team2: MapMarker[] };
  spawns: { team1: MapMarker[]; team2: MapMarker[] };
  controlPoint: MapMarker | null;
  pois: { marker: MapMarker; type: number }[];
};

export type { BattleEconomy };

/**
 * Which view of a battle is open, as the game's own results screen names them.
 *
 * Here rather than beside the component that draws them, because the battle
 * page reads `?tab=` on the server, and a value imported from a client module
 * reaches a server component as a client reference rather than as a string.
 */
export enum BattleTab {
  Teams = "teams",
  Report = "report",
  Replay = "replay",
}

/**
 * What the battle endpoint hands over, as the roster and its panel read it.
 *
 * Kept apart from both so the panel and the table agree by construction rather
 * than by two hand-written copies drifting.
 */
export type Participant = {
  /** Battle-scoped vehicle id, unique within the battle. */
  id: number;
  account?: number;
  player: PlayerIdentity | null;
  team: number;
  tank: {
    id: number;
    shortName: string;
    name: string;
    tier: number;
    type: string;
    nation: string;
    tag: string;
    slug: string | null;
  } | null;
  /**
   * Their whole line as a bag of numbers.
   *
   * Every field is optional because the mod sends each only when it is
   * non-zero, and because a battle recorded by a client older than a field
   * carries none of it. A missing figure means "nothing to report", which is
   * why the panel drops its row rather than drawing a zero.
   */
  own: Partial<Record<string, number>>;
  /** The medals this battle awarded them, by the game's own ids. */
  medals?: number[];
  rating: Partial<Record<string, number | null>>;
  /**
   * What the battle earned them, present only for the player whose page this
   * is AND only when their own client reported it. See `BattleEconomy`.
   */
  personal?: BattleEconomy | null;
  /** What they had fitted, per life, when a recording of this battle said so. */
  loadouts?: BattleLoadoutView[];
};

/** One loadout slot, named and pictured, or empty. */
export type BattleLoadoutSlot = {
  name: string | null;
  image: string | null;
  overlay: string | null;
};

/** One vehicle's loadout for one life, as the battle endpoint names it. */
export type BattleLoadoutView = {
  life: number;
  optDevices: BattleLoadoutSlot[];
  boosters: BattleLoadoutSlot[];
  consumables: BattleLoadoutSlot[];
  shells: { kind: string; count: number; premium: boolean; image: string }[];
  fieldMods: BattleLoadoutSlot[];
  crew: {
    role: string;
    roleImage: string | null;
    skills: { name: string; image: string }[];
  }[];
};

export type BattleDetailData = {
  id: string;
  duration: number | null;
  winnerTeam: number | null;
  finishReason: number | null;
  server: string | null;
  clientVersion: string | null;
  reporters: number;
  /** Whether the archive holds this battle's replay, so the viewer has something to draw. */
  hasReplay: boolean;
  /**
   * Where one player's mark stood after this battle, and after the one before,
   * with `account` naming whose gun it is.
   *
   * The owner has to travel with the figure. It comes from one client's own
   * results, so in a battle somebody else reported it belongs to them, and a
   * page showing another participant was putting a stranger's mark and a
   * stranger's progress under its own player's name.
   */
  mark: { percent: number; previous: number | null; account: number } | null;
  participants: Participant[];
};
