/**
 * What each battle chat command id means, by the key its words are filed under.
 *
 * The `0x31` packet carries a NUMBER, not a sentence: the quick commands, the
 * reload callouts and the map pings are all `bw_chat2.onActionReceived` with an
 * action id. Resolving it needs the client's own two halves, both read out of
 * the sources rather than guessed:
 *
 *  - the order, from `BATTLE_CHAT_COMMANDS` in `common/messenger_common_chat2.py`,
 *    where each entry takes the next id from a plain counter;
 *  - the base, 24, by walking `MESSENGER_ACTION_IDS` through that same counter
 *    (`_BATTLE_CHAT_COMMAND_START_ID = _makeID(range=100)`).
 *
 * Confirmed before being trusted: id 79 resolved to `PREBATTLE_WAYPOINT` in a
 * packet that also carried `#ingame_gui:prebattlemarker/prebattlemarker_2`,
 * which is the same thing said twice and cannot line up by accident.
 *
 * **The words are not here.** `key` is the client's own `msgText`, which is how
 * `game/chat-commands` files the sentence in every language the game ships in,
 * the same way the maps and the equipment are named. The English beside it is
 * the fallback for a reader whose language that namespace has no entry for, and
 * nothing more: a French page says "Je recharge !" because the client does, not
 * because a model rendered "Reloading!".
 */
export const CHAT_COMMANDS: Record<
  number,
  { name: string; key: string; english: string }
> = {
  24: { name: "SOS", key: "help_me", english: "Help!" },
  25: { name: "POSITIVE", key: "positive", english: "%(target)s, affirmative!" },
  26: { name: "NEGATIVE", key: "negative", english: "Negative!" },
  27: { name: "AFFIRMATIVE", key: "affirmative", english: "Affirmative!" },
  28: { name: "ATTENTIONTOCELL", key: "attention_to_cell", english: "Attention to %(cellName)s!" },
  29: { name: "ATTENTION_TO_POSITION", key: "attention_to_position", english: "Attention to position!" },
  32: { name: "ATTACK_OBJECTIVE", key: "attention_to_objective_atk", english: "Destroy objective %(int32Arg1)s" },
  33: { name: "ATTACKING_OBJECTIVE", key: "attention_to_objective_atk_autocommit", english: "I'm attacking objective %(int32Arg1)s!" },
  34: { name: "DEFEND_OBJECTIVE", key: "attention_to_objective_def", english: "Defend objective %(int32Arg1)s" },
  35: { name: "DEFENDING_OBJECTIVE", key: "attention_to_objective_def_autocommit", english: "I'm defending objective %(int32Arg1)s!" },
  36: { name: "ATTACK_BASE", key: "attention_to_base_atk", english: "Capture the base!" },
  37: { name: "DEFEND_BASE", key: "attention_to_base_def", english: "Defend the base!" },
  38: { name: "SPG_AIM_AREA", key: "spg_aim_area", english: "Targeting position. Ready to fire!" },
  39: { name: "ATTACKING_ENEMY_WITH_SPG", key: "attack_enemy_with_SPG", english: "Ready to fire! Attacking %(target)s!" },
  40: { name: "TURNBACK", key: "turn_back", english: "%(target)s, fall back!" },
  41: { name: "HELPME", key: "help_me_ex", english: "%(target)s, help!" },
  42: { name: "ATTACK_ENEMY", key: "attack_enemy", english: "Requesting fire at %(target)s!" },
  43: { name: "RELOADINGGUN", key: "reloading_gun", english: "Reloading! %(floatArg1)d s left!" },
  44: { name: "THANKS", key: "thanks", english: "%(target)s, thank you!" },
  45: { name: "RELOADING_CASSETE", key: "reloading_cassette", english: "Ready to fire in %(floatArg1)d s; shells in the magazine: %(int32Arg1)s item(s)." },
  46: { name: "RELOADING_READY", key: "reloading_ready", english: "Ready to fire!" },
  47: { name: "RELOADING_READY_CASSETE", key: "reloading_ready_cassette", english: "Ready to fire! Shells in the magazine: %(int32Arg1)s item(s)." },
  48: { name: "RELOADING_UNAVAILABLE", key: "reloading_unavailable", english: "Ammunition is empty." },
  49: { name: "OVERHEATEDGUN", key: "overheated_gun", english: "Gun overheated! Can't fire for %(floatArg1)d s" },
  50: { name: "EPIC_GLOBAL_SAVE_TANKS_ATK", key: "global_msg/atk/save_tanks", english: "We have enough time, save your tanks!" },
  51: { name: "GOING_THERE", key: "going_there", english: "Driving to position!" },
  52: { name: "EPIC_GLOBAL_SAVE_TANKS_DEF", key: "global_msg/def/save_tanks", english: "We need to hold out, save your tanks!" },
  53: { name: "EPIC_GLOBAL_TIME_ATK", key: "global_msg/atk/time", english: "Time is running out, capture a zone with all you've got!" },
  54: { name: "EPIC_GLOBAL_TIME_DEF", key: "global_msg/def/time", english: "Time is running out, defend the zones at all costs!" },
  55: { name: "EPIC_GLOBAL_HQ_ATK", key: "global_msg/atk/focus_hq", english: "Destroy objectives!" },
  56: { name: "EPIC_GLOBAL_HQ_DEF", key: "global_msg/def/focus_hq", english: "Defend the objectives!" },
  57: { name: "EPIC_GLOBAL_WEST", key: "global_msg/lane/west", english: "Zone %(strArg1)s needs help, reinforce it!" },
  58: { name: "EPIC_GLOBAL_CENTER", key: "global_msg/lane/center", english: "Zone %(strArg1)s needs help, reinforce it!" },
  59: { name: "EPIC_GLOBAL_EAST", key: "global_msg/lane/east", english: "Zone %(strArg1)s needs help, reinforce it!" },
  75: { name: "ATTACKING_ENEMY", key: "attacking_enemy", english: "Attacking %(target)s!" },
  76: { name: "SUPPORTING_ALLY", key: "supporting_ally", english: "%(target)s, I'll help you!" },
  77: { name: "DEFENDING_BASE", key: "defending_base", english: "I'll defend the base!" },
  78: { name: "ATTACKING_BASE", key: "attacking_base", english: "I'll capture the base!" },
  79: { name: "PREBATTLE_WAYPOINT", key: "going_there", english: "Driving to position!" },
  85: { name: "MOVE_TO_TARGET_POINT", key: "move_to_target", english: "Move to target: %(target)s" },
  86: { name: "MOVING_TO_TARGET_POINT", key: "move_to_target_autocommit", english: "I'm moving to target: %(target)s!" },
};
