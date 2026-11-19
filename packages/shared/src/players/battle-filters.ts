/** How a battle ended for one side, as the battles list can be filtered on it.
 * A battle that named no winner has none, and no filter finds it. */
export enum BattleResultFilter {
  Win = "win",
  Loss = "loss",
  Draw = "draw",
}

/**
 * What the replay catalogue can be ranked by. Each figure but the date is the
 * one the battle's reporter scored, since a battle row is drawn from their side.
 */
export enum BattleCatalogSort {
  Recent = "recent",
  Damage = "damage",
  Assist = "assist",
  Xp = "xp",
  Kills = "kills",
  /** The replays most opened. */
  Views = "views",
  /** The replays most downloaded. */
  Downloads = "downloads",
}

/** The catalogue's default order: the most damage first, which is what a
 * replay is looked up for. */
export const DEFAULT_BATTLE_CATALOG_SORT = BattleCatalogSort.Damage;

/** The `version` a request names to mean the newest update the catalogue holds,
 * so a link to "the current patch" keeps meaning it after the next one. */
export const LATEST_BATTLE_VERSION = "latest";
