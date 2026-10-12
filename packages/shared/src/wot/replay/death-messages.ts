/**
 * How a vehicle died, as the message the battle feed would have printed.
 *
 * A replay carries `deathReason` as a number and the game turns it into a
 * sentence in two steps, both read out of the client rather than guessed:
 *
 *  - the number indexes `ATTACK_REASONS` in `common/constants.py`, so 0 is a
 *    shot, 2 ramming, 5 drowning, 7 overturning;
 *  - `_ATTACK_REASON_CODE` in `battle_control/controllers/msgs_ctrl.py` folds
 *    those into the handful of messages that exist, which is why fire and a
 *    dozen pieces of equipment all come out as `DEATH_FROM_SHOT`.
 *
 * The full key adds the two sides, `_<attacker>_<target>` from `_ENTITY_TYPE`
 * (`ally`, `enemy`, `self`, `suicide`), and those are relative to whoever is
 * reading: "Ally X destroyed Y" and "Enemy X destroyed enemy Y" are the same
 * event seen from the two benches.
 */
export const DEATH_MESSAGE_CODE: Record<number, string> = {
  0: "DEATH_FROM_SHOT",
  1: "DEATH_FROM_SHOT",
  2: "DEATH_FROM_RAMMING",
  3: "DEATH_FROM_WORLD_COLLISION",
  4: "DEATH_FROM_DEATH_ZONE",
  5: "DEATH_FROM_DROWNING",
  7: "DEATH_FROM_OVERTURN",
  9: "DEATH_FROM_ARTILLERY_PROTECTION",
  10: "DEATH_FROM_SECTOR_PROTECTION",
  11: "DEATH_FROM_SECTOR_BOMBERS",
  12: "DEATH_FROM_RECOVERY",
  13: "DEATH_FROM_SHOT",
  14: "DEATH_FROM_SHOT",
  15: "DEATH_FROM_SHOT",
  17: "DEATH_FROM_SHOT",
  20: "DEATH_FROM_SHOT",
  22: "DEATH_FROM_SHOT",
  23: "DEATH_FROM_SHOT",
  24: "DEATH_FROM_SHOT",
  27: "DEATH_FROM_SHOT",
  28: "DEATH_FROM_STATIC_DEATH_ZONE",
  29: "DEATH_FROM_WORLD_COLLISION",
  32: "DEATH_FROM_MINEFIELD_ZONE",
  33: "DEATH_FROM_SHOT",
  34: "DEATH_FROM_SHOT",
};
