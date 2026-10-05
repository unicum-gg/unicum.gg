import type { BattleEconomy } from "@unicum.gg/shared";
import type { PlayerIdentity } from "@/components/entity/player-identity";

export type { BattleEconomy };

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
};

export type BattleDetailData = {
  id: string;
  duration: number | null;
  winnerTeam: number | null;
  finishReason: number | null;
  server: string | null;
  clientVersion: string | null;
  reporters: number;
  participants: Participant[];
};
