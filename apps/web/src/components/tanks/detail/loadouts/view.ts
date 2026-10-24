import type { Region } from "@unicum.gg/wargaming";
import type { PlayerIdentity } from "@/components/entity/player-identity";
import type {
  LoadoutCrewView,
  LoadoutSlotView,
} from "@/components/players/detail/tanks/loadout-boxes";
import type {
  LoadoutMode,
  LoadoutPerformance,
  LoadoutRatings,
  TankLoadoutStats,
  TopBattle,
} from "@unicum.gg/shared";
import type { PlayerBattleRow } from "@/components/players/detail/overview/battles-table";

/**
 * What the Loadouts panels are handed, once the server has done the naming.
 *
 * Every key the mod reports is a client identifier, and the catalogues that
 * turn one into a name a reader can read are stripped before the dictionaries
 * cross the wire (`SERVER_ONLY_NAMESPACES`). So nothing below is a key: the tab
 * resolves each one against the vehicle's own catalogue on the server and hands
 * these down as finished text and finished URLs, exactly as the player page's
 * loadout panel does.
 */

/** One picture in a row's identity: a device, a consumable, a directive. */
export interface RowIcon {
  name: string;
  image: string | null;
  /** The grade badge the game composites on bond, bounty or experimental gear. */
  overlay?: string | null;
  /** Equipment 2.0 categories, drawn as the game's coloured dots. */
  categories?: string[];
}

/**
 * One row of the main table: a whole choice, how many made it, and how they do.
 *
 * `icons` rather than a name, because the row's identity is a set of pictures a
 * player recognises at a glance, and three device names side by side is a
 * paragraph. The names ride along as each picture's title.
 */
export interface LoadoutTableRow {
  key: string;
  icons: RowIcon[];
  /** Players who ran it. */
  count: number;
  /** Battles it was fitted in. */
  battles: number;
  share: number;
  performance: LoadoutPerformance;
}

/** One seat: its name, how many players have it, and a row per skill. */
export interface CrewSeatRows {
  role: string;
  roleLabel: string;
  roleImage: string | null;
  /** Players whose crew has this seat: what the skills' shares are over. */
  crews: number;
  rows: LoadoutTableRow[];
}

/** One of the best players in the vehicle, named and pictured. */
export interface TopPlayerRow {
  identity: PlayerIdentity;
  region: Region;
  battles: number;
  winrate: number | null;
  avgDamage: number | null;
  rating: LoadoutRatings;
  /** By slot; a free slot is drawn empty. */
  equipment: LoadoutSlotView[];
  directives: LoadoutSlotView[];
  consumables: LoadoutSlotView[];
  /** Every pair of the tree; a pair not taken is drawn as an empty slot. */
  fieldMods: LoadoutSlotView[];
  shells: { kind: string; count: number; premium: boolean; image: string }[];
  /** One entry per seat, as the garage panel's crew group draws it. */
  crew: LoadoutCrewView[];
}

/** One player's best battle, as the endpoint answers it: who, and the battle
 * itself in the Battles tab's own shape. */
export interface TopBattlePayload {
  player: Omit<TopBattle, "arenaUniqueId" | "startedAt">;
  battle: PlayerBattleRow;
}

/** What the endpoint answers for one mode: the aggregate, with the best
 * battles already drawn as battle rows. */
export type TankLoadoutsPayload = Omit<TankLoadoutStats, "topBattles"> & {
  topBattles: TopBattlePayload[];
};

/** One battle mode's figures. What the page loads and the tab draws. */
export interface TankLoadoutModeView {
  mode: LoadoutMode;
  stats: TankLoadoutsPayload;
}
