/**
 * What the numbers in a replay's loadout mean, by the names the rest of the
 * site already uses.
 *
 * The mod reads a loadout out of the running client and sends NAMES, which is
 * what `tank_loadouts` stores and what every loadout component draws. A replay
 * carries the same loadout as INTEGERS, because the wire format is the client's
 * own: the `setups` property is a dictionary of int compact descriptors, and a
 * crew member's skills are indices into one fixed tuple. Without these tables a
 * replay-sourced loadout could not be put beside a garage-sourced one, and no
 * aggregate could ever mix the two.
 *
 * An int compact descriptor packs three things into one integer:
 *
 *     intCD = (itemID << 8) + itemTypeID + (nationID << 4)
 *
 * so the low nibble is the kind of item, the next nibble is the nation, and the
 * rest is the id inside that kind. Optional devices and equipment are global
 * rather than national, which is why both carry nation 15 (`nations.NONE_INDEX`).
 *
 * Read out of the client's own definitions rather than typed by hand:
 *
 *  - `item_defs/vehicles/common/optional_devices.xml`, where each child of the
 *    root is an item whose element name IS the name and whose `<id>` is the id.
 *    The four files under `optional_devices/` hold the same 89 ids, split by
 *    family, so the flat file is the whole set and not a subset of it;
 *  - `item_defs/vehicles/common/equipments.xml`, the same shape, and the source
 *    of consumables AND battle boosters, which the client numbers together;
 *  - `SKILL_NAMES` in `common/items/components/skills_constants.py`, a tuple
 *    whose INDEX is what a crew member's skill mask refers to. The `reserved`
 *    entries are real: they are retired skills whose slots were never reused,
 *    and dropping them would shift every later skill by one.
 *
 * Checked against decoded bytes before being trusted. From one random battle
 * and two Onslaught replays, `29945 30713 13561` resolved to
 * `trophyUpgradedTurbocharger`, `trophyUpgradedExtraHealthReserve` and
 * `trophyBasicTankRammer`, `1275 763 25851` to `smallRepairkit`, `smallMedkit`
 * and `cocacola`, and `51963` to `turbochargerBattleBooster` -- each of which
 * the same replay also showed mounted on the player's own vehicle, read by a
 * second path through the full compact descriptor.
 *
 * Generated, and DATA ONLY. Anything that decides something -- which entries
 * are not real skills, what to do with an id these tables do not hold -- lives
 * in `loadout.ts`, so that regenerating this file can never quietly revert a
 * judgement. Regenerate from the client sources rather than editing by hand.
 */

/** The low nibble of an int compact descriptor: what kind of item it is. */
export const ITEM_TYPE = {
  optionalDevice: 9,
  shell: 10,
  equipment: 11,
} as const;

/** `nations.NONE_INDEX`, carried by every item that is not national. */
export const NO_NATION = 15;

/** The three parts an int compact descriptor packs together. */
export interface IntCompactDescr {
  /** One of `ITEM_TYPE`. */
  type: number;
  /** Index into the client's nation list, or `NO_NATION`. */
  nation: number;
  /** The item's id within its kind. */
  id: number;
}

/** Split an int compact descriptor without deciding what it names. */
export function splitIntCompactDescr(intCD: number): IntCompactDescr {
  return { type: intCD & 0x0f, nation: (intCD >> 4) & 0x0f, id: intCD >>> 8 };
}

/** Optional devices, by the id an int compact descriptor carries. */
export const OPTIONAL_DEVICES: Record<number, string> = {
  43: "deluxImprovedConfiguration",
  44: "deluxImprovedVentilation",
  45: "deluxRammer",
  46: "deluxCoatedOptics",
  47: "deluxAimingStabilizer",
  48: "deluxEnhancedAimDrives",
  50: "trophyBasicAimDrives",
  51: "trophyUpgradedAimDrives",
  52: "trophyBasicTankRammer",
  53: "trophyUpgradedTankRammer",
  54: "trophyBasicImprovedVentilation",
  55: "trophyUpgradedImprovedVentilation",
  56: "trophyBasicAimingStabilizer",
  57: "trophyUpgradedAimingStabilizer",
  58: "trophyBasicCoatedOptics",
  59: "trophyUpgradedCoatedOptics",
  61: "improvedConfiguration_tier2",
  62: "improvedConfiguration_tier1",
  63: "antifragmentationLining_tier4",
  64: "antifragmentationLining_tier3",
  65: "antifragmentationLining_tier2",
  66: "antifragmentationLining_tier1",
  67: "stereoscope_tier3",
  68: "stereoscope_tier2",
  69: "stereoscope_tier1",
  70: "coatedOptics_tier3",
  71: "coatedOptics_tier2",
  72: "coatedOptics_tier1",
  73: "camouflageNet_tier3",
  74: "camouflageNet_tier2",
  75: "improvedVentilation_tier3",
  76: "improvedVentilation_tier2",
  77: "improvedVentilation_tier1",
  78: "grousers_tier3",
  79: "grousers_tier2",
  80: "grousers_tier1",
  81: "tankRammer_tier2",
  82: "tankRammer_tier1",
  83: "enhancedAimDrives_tier3",
  84: "enhancedAimDrives_tier2",
  85: "enhancedAimDrives_tier1",
  86: "aimingStabilizer_tier2",
  87: "aimingStabilizer_tier1",
  88: "additionalInvisibilityDevice_tier3",
  89: "additionalInvisibilityDevice_tier2",
  90: "additionalInvisibilityDevice_tier1",
  91: "extraHealthReserve_tier3",
  92: "extraHealthReserve_tier2",
  93: "extraHealthReserve_tier1",
  94: "improvedRadioCommunication",
  95: "improvedRotationMechanism_tier2",
  96: "improvedRotationMechanism_tier1",
  97: "turbocharger_tier3",
  98: "turbocharger_tier2",
  99: "turbocharger_tier1",
  100: "commandersView",
  101: "improvedSights_tier2",
  102: "improvedSights_tier1",
  105: "trophyBasicImprovedConfiguration",
  106: "trophyUpgradedImprovedConfiguration",
  107: "trophyBasicImprovedRotationMechanism",
  108: "trophyUpgradedImprovedRotationMechanism",
  109: "trophyBasicImprovedSights",
  110: "trophyUpgradedImprovedSights",
  111: "deluxeTurbocharger",
  112: "deluxeExtraHealthReserve",
  113: "trophyBasicAdditionalInvisibilityDevice",
  114: "trophyUpgradedAdditionalInvisibilityDevice",
  115: "trophyBasicTurbocharger",
  116: "trophyUpgradedTurbocharger",
  117: "deluxeImprovedRotationMechanism",
  118: "trophyBasicExtraHealthReserve",
  119: "trophyUpgradedExtraHealthReserve",
  120: "deluxeImprovedSights",
  121: "deluxeAdditionalInvisibilityDevice",
  122: "deluxeStereoscope",
  123: "deluxeCamouflageNet",
  150: "modernizedAimDrivesAimingStabilizer1",
  151: "modernizedAimDrivesAimingStabilizer2",
  152: "modernizedAimDrivesAimingStabilizer3",
  153: "modernizedTurbochargerRotationMechanism1",
  154: "modernizedTurbochargerRotationMechanism2",
  155: "modernizedTurbochargerRotationMechanism3",
  156: "modernizedExtraHealthReserveAntifragmentationLining1",
  157: "modernizedExtraHealthReserveAntifragmentationLining2",
  158: "modernizedExtraHealthReserveAntifragmentationLining3",
  159: "modernizedImprovedSightsEnhancedAimDrives1",
  160: "modernizedImprovedSightsEnhancedAimDrives2",
  161: "modernizedImprovedSightsEnhancedAimDrives3",
};

/** Consumables and battle boosters, which the client numbers as one kind. */
export const EQUIPMENTS: Record<number, string> = {
  0: "handExtinguishers",
  1: "autoExtinguishers",
  2: "smallMedkit",
  3: "largeMedkit",
  4: "smallRepairkit",
  5: "largeRepairkit",
  9: "chocolate",
  11: "ration",
  12: "removedRpmLimiter",
  13: "hotCoffee",
  14: "afterburning",
  15: "ration_china",
  17: "ration_uk",
  18: "ration_japan",
  45: "artillery_cw_tier6",
  47: "artillery_cw_tier8",
  49: "artillery_cw_tier10",
  55: "bomber_cw_tier6",
  57: "bomber_cw_tier8",
  59: "bomber_cw_tier10",
  61: "ration_czech",
  62: "ration_sweden",
  63: "ration_poland",
  64: "ration_italy",
  65: "qualityFuel",
  66: "excellentFuel",
  100: "cocacola",
  101: "artillery_fallout",
  102: "bomber_fallout",
  103: "improvedConfigurationBattleBooster",
  104: "improvedVentilationBattleBooster",
  105: "rammerBattleBooster",
  106: "coatedOpticsBattleBooster",
  107: "aimingStabilizerBattleBooster",
  108: "enhancedAimDrivesBattleBooster",
  109: "camouflageBattleBooster",
  110: "smoothTurretBattleBooster",
  111: "virtuosoBattleBooster",
  112: "smoothDrivingBattleBooster",
  113: "fireFightingBattleBooster",
  114: "sixthSenseBattleBooster",
  115: "rancorousBattleBooster",
  116: "pedantBattleBooster",
  117: "lastEffortBattleBooster",
  118: "artillery_epic",
  119: "bomber_epic",
  120: "recon_epic",
  180: "builtinRepairkit",
  202: "turbochargerBattleBooster",
  203: "improvedSightsBattleBooster",
  204: "additInvisibilityDeviceBattleBooster",
  205: "practicalityBattleBooster",
  206: "enemyShotPredictorBattleBooster",
  300: "recon_epic_8_9lvl_level1",
  301: "recon_epic_8_9lvl_level2",
  302: "recon_epic_8_9lvl_level3",
  303: "recon_epic_8lvl_level1",
  304: "recon_epic_8lvl_level2",
  305: "recon_epic_8lvl_level3",
  310: "bomber_epic_8_9lvl_level1",
  311: "bomber_epic_8_9lvl_level2",
  312: "bomber_epic_8_9lvl_level3",
  313: "bomber_epic_8lvl_level1",
  314: "bomber_epic_8lvl_level2",
  315: "bomber_epic_8lvl_level3",
  320: "artillery_epic_8_9lvl_level1",
  321: "artillery_epic_8_9lvl_level2",
  322: "artillery_epic_8_9lvl_level3",
  323: "artillery_epic_8lvl_level1",
  324: "artillery_epic_8lvl_level2",
  325: "artillery_epic_8lvl_level3",
  330: "smoke_epic_8_9lvl_level1",
  331: "smoke_epic_8_9lvl_level2",
  332: "smoke_epic_8_9lvl_level3",
  333: "smoke_epic_8lvl_level1",
  334: "smoke_epic_8lvl_level2",
  335: "smoke_epic_8lvl_level3",
  340: "inspire_8_9lvl_level1",
  341: "inspire_8_9lvl_level2",
  342: "inspire_8_9lvl_level3",
  343: "inspire_8lvl_level1",
  344: "inspire_8lvl_level2",
  345: "inspire_8lvl_level3",
  350: "passive_engineering_8_9lvl_level1",
  351: "passive_engineering_8_9lvl_level2",
  352: "passive_engineering_8_9lvl_level3",
  353: "passive_engineering_8lvl_level1",
  354: "passive_engineering_8lvl_level2",
  355: "passive_engineering_8lvl_level3",
  360: "arcade_minefield_epic_battle_8_9lvl_level1",
  361: "arcade_minefield_epic_battle_8_9lvl_level2",
  362: "arcade_minefield_epic_battle_8_9lvl_level3",
  363: "arcade_minefield_epic_battle_8lvl_level1",
  364: "arcade_minefield_epic_battle_8lvl_level2",
  365: "arcade_minefield_epic_battle_8lvl_level3",
  370: "fl_regenerationKit_8_9lvl_level1",
  371: "fl_regenerationKit_8_9lvl_level2",
  372: "fl_regenerationKit_8_9lvl_level3",
  373: "fl_regenerationKit_8lvl_level1",
  374: "fl_regenerationKit_8lvl_level2",
  375: "fl_regenerationKit_8lvl_level3",
  380: "stealth_radar_8_9lvl_level1",
  381: "stealth_radar_8_9lvl_level2",
  382: "stealth_radar_8_9lvl_level3",
  383: "stealth_radar_8lvl_level1",
  384: "stealth_radar_8lvl_level2",
  385: "stealth_radar_8lvl_level3",
  386: "bomber_epic_8_9lvl_level4",
  387: "bomber_epic_8lvl_level4",
  388: "artillery_epic_8_9lvl_level4",
  389: "artillery_epic_8lvl_level4",
  390: "arcade_minefield_epic_battle_8_9lvl_level4",
  391: "arcade_minefield_epic_battle_8lvl_level4",
  392: "recon_epic_8_9lvl_level4",
  393: "recon_epic_8lvl_level4",
  394: "stealth_radar_8_9lvl_level4",
  395: "stealth_radar_8lvl_level4",
  396: "passive_engineering_8_9lvl_level4",
  397: "passive_engineering_8lvl_level4",
  398: "inspire_8_9lvl_level4",
  399: "inspire_8lvl_level4",
  400: "artillery_aoe_fort_6lvl_1",
  401: "artillery_aoe_fort_6lvl_2",
  402: "artillery_aoe_fort_6lvl_3",
  403: "artillery_aoe_fort_6lvl_4",
  404: "artillery_aoe_fort_6lvl_5",
  405: "artillery_aoe_fort_6lvl_6",
  406: "artillery_aoe_fort_6lvl_7",
  407: "artillery_aoe_fort_6lvl_8",
  408: "artillery_aoe_fort_6lvl_9",
  409: "artillery_aoe_fort_6lvl_10",
  410: "artillery_aoe_fort_6lvl_11",
  411: "artillery_aoe_fort_6lvl_12",
  412: "artillery_aoe_fort_8lvl_1",
  413: "artillery_aoe_fort_8lvl_2",
  414: "artillery_aoe_fort_8lvl_3",
  415: "artillery_aoe_fort_8lvl_4",
  416: "artillery_aoe_fort_8lvl_5",
  417: "artillery_aoe_fort_8lvl_6",
  418: "artillery_aoe_fort_8lvl_7",
  419: "artillery_aoe_fort_8lvl_8",
  420: "artillery_aoe_fort_8lvl_9",
  421: "artillery_aoe_fort_8lvl_10",
  422: "artillery_aoe_fort_8lvl_11",
  423: "artillery_aoe_fort_8lvl_12",
  424: "artillery_aoe_fort_10lvl_1",
  425: "artillery_aoe_fort_10lvl_2",
  426: "artillery_aoe_fort_10lvl_3",
  427: "artillery_aoe_fort_10lvl_4",
  428: "artillery_aoe_fort_10lvl_5",
  429: "artillery_aoe_fort_10lvl_6",
  430: "artillery_aoe_fort_10lvl_7",
  431: "artillery_aoe_fort_10lvl_8",
  432: "artillery_aoe_fort_10lvl_9",
  433: "artillery_aoe_fort_10lvl_10",
  434: "artillery_aoe_fort_10lvl_11",
  435: "artillery_aoe_fort_10lvl_12",
  436: "inspire_fort1",
  437: "inspire_fort2",
  438: "inspire_fort3",
  439: "inspire_fort4",
  440: "inspire_fort5",
  441: "inspire_fort6",
  442: "inspire_fort7",
  443: "inspire_fort8",
  444: "inspire_fort9",
  445: "inspire_fort10",
  446: "inspire_fort11",
  447: "inspire_fort12",
  448: "smoke_epic_8_9lvl_level4",
  449: "smoke_epic_8lvl_level4",
  450: "fl_regenerationKit_8_9lvl_level4",
  451: "fl_regenerationKit_8lvl_level4",
  452: "epic_empty_slot",
  900: "exampleAbility",
  9101: "arcade_artillery_aoe",
  9201: "arcade_bomber_aoe",
  9301: "artillery_deathzone_aoe",
  9401: "poi_artillery_aoe",
  9402: "poi_radar",
  9403: "poi_illumination_flare",
  9501: "comp7_aoe_heal",
  9502: "comp7_ally_support",
  9503: "comp7_hunter",
  9504: "comp7_concentration",
  9505: "comp7_berserk",
  9506: "comp7_aoe_inspire",
  9507: "comp7_redline",
  9508: "comp7_fast_recharge",
  9509: "comp7_juggernaut",
  9510: "comp7_sure_shot",
  9511: "comp7_sniper",
  9512: "comp7_risky_attack",
  9513: "comp7_recon",
  9514: "comp7_aggressive_detection",
  9515: "comp7_march",
  9521: "comp7_light_aoe_heal",
  9522: "comp7_light_ally_support",
  9523: "comp7_light_hunter",
  9524: "comp7_light_concentration",
  9525: "comp7_light_berserk",
  9526: "comp7_light_aoe_inspire",
  9527: "comp7_light_redline",
  9528: "comp7_light_fast_recharge",
  9529: "comp7_light_juggernaut",
  9530: "comp7_light_sure_shot",
  9531: "comp7_light_sniper",
  9532: "comp7_light_risky_attack",
  9533: "comp7_light_recon",
  9534: "comp7_light_aggressive_detection",
  9535: "comp7_light_march",
};

/** `SKILL_NAMES`, where the position is the identity. */
export const CREW_SKILLS: readonly string[] = [
  "reserved", "commander", "radioman", "driver",
  "gunner", "loader", "repair", "fireFighting",
  "camouflage", "brotherhood", "any", "armorPatching",
  "reserved", "reserved", "reserved", "reserved",
  "commander_tutor", "commander_eagleEye", "commander_sixthSense", "commander_expert",
  "commander_universalist", "commander_enemyShotPredictor", "commander_practical", "commander_emergency",
  "commander_coordination", "commander_holdLine", "commander_staySharp", "reserved",
  "driver_virtuoso", "driver_smoothDriving", "driver_badRoadsKing", "driver_rammingMaster",
  "driver_tidyPerson", "driver_motorExpert", "driver_reliablePlacement", "driver_suspensionRepair",
  "driver_bulletproof", "gunner_gunsmith", "gunner_sniper", "gunner_smoothTurret",
  "gunner_rancorous", "gunner_focus", "gunner_quickAiming", "gunner_armorer",
  "gunner_pointBlast", "gunner_loneWolf", "loader_pedant", "loader_desperado",
  "loader_intuition", "loader_perfectCharge", "loader_ammunitionImprove", "loader_melee",
  "loader_magMastery", "radioman_inventor", "radioman_finder", "radioman_retransmitter",
  "radioman_lastEffort", "radioman_interference", "radioman_signalInterception", "radioman_sideBySide",
  "radioman_expert", "radioman_battleTempered", "radioman_threatSearch", "loader_secondChance",
];

/** `ORDERED_ROLES`, the seats a crew is read out in. */
export const CREW_ROLES: readonly string[] = [
  "commander", "gunner", "driver", "radioman", "loader",
];
