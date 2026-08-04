// Every top-level battle type a map can belong to. Derived from the game's
// static client scripts, except Clan Wars, whose map pool is the live Global Map
// season (set server-side) and is appended by the catalogue layer.
export enum BattleType {
  Random = "random",
  BattleRoyale = "battle_royale",
  Frontline = "frontline",
  Onslaught = "onslaught",
  GrandBattle = "grand_battle",
  ClanWars = "clan_wars",
  Waffentrager = "waffentrager",
  LastStand = "last_stand",
  Arcade = "arcade",
  StoryMode = "story_mode",
  Training = "training",
}

export const BATTLE_TYPE_LABEL: Record<BattleType, string> = {
  [BattleType.Random]: "Random",
  [BattleType.BattleRoyale]: "Battle Royale",
  [BattleType.Frontline]: "Frontline",
  [BattleType.Onslaught]: "Onslaught",
  [BattleType.GrandBattle]: "Grand Battle",
  [BattleType.ClanWars]: "Clan Wars",
  [BattleType.Waffentrager]: "Waffenträger",
  [BattleType.LastStand]: "Last Stand",
  [BattleType.Arcade]: "Arcade",
  [BattleType.StoryMode]: "Story Mode",
  [BattleType.Training]: "Training",
};

/** Battle types played as even-sided PvP, where a symmetric "X v X" team size is
 * meaningful. Battle Royale is a free-for-all, and the event/PvE modes
 * (Waffenträger, Last Stand, Story Mode, Arcade) have their own co-op/wave
 * structure the arena_def doesn't encode, so a team size isn't asserted for them
 * (the page and the OG card both suppress it). */
export const TEAM_SIZE_BATTLE_TYPES = new Set<BattleType>([
  BattleType.Random,
  BattleType.Frontline,
  BattleType.Onslaught,
  BattleType.GrandBattle,
  BattleType.ClanWars,
  BattleType.Training,
]);

// Event/mode map variants that are NOT distinguished by a gameplay token but by
// an arena-id suffix. Each carries the display tag appended to the base map name
// ("Steppes (Waffenträger)") and the battle type it belongs to (null = no PvP
// bucket, e.g. an unlabelled scenic variant). Ordered longest/most-specific
// first. `baseId` is the capture group used to resolve the base map's name.
export type MapVariant = {
  baseId: string;
  tag: string;
  battleType: BattleType | null;
};

const VARIANT_RULES: {
  re: RegExp;
  tag: string;
  battleType: BattleType | null;
}[] = [
  { re: /^(.*)_last_stand$/, tag: "Last Stand", battleType: BattleType.LastStand },
  { re: /^(.*)_ls\d+(?:_\d+)?$/, tag: "Last Stand", battleType: BattleType.LastStand },
  { re: /^(.*)_wt$/, tag: "Waffenträger", battleType: BattleType.Waffentrager },
  // `_scc` = a Story Mode campaign chapter (team=1, story banks) that reuses its
  // base map's name, so it needs disambiguating ("Nordskar" -> "Nordskar (Story
  // Mode)"). Other Story Mode maps keep their own distinct names.
  { re: /^(.*)_scc$/, tag: "Story Mode", battleType: BattleType.StoryMode },
];

/** Classify an arena id as an event/mode variant of a base map, or null. */
export function variantOf(arenaId: string): MapVariant | null {
  for (const rule of VARIANT_RULES) {
    const m = rule.re.exec(arenaId);
    if (m) return { baseId: m[1], tag: rule.tag, battleType: rule.battleType };
  }
  return null;
}

// The arcade "School" minigame maps: their own dedicated ids with no gameplay
// geometry, so they can't be derived from a token. Keyed by exact id.
const ARCADE_IDS = new Set(["140_fall_tanks", "141_dash_to_go", "142_road_to_dash"]);

const RANDOM_TOKENS = new Set(["ctf", "domination", "assault", "assault2"]);

/** Classify a map's battle types from its arena id + raw gameplay tokens (and,
 * for the Story Mode tell, its team size). The dedicated arenas are exclusive:
 * Battle Royale (`*_br_*`, placeholder `ctf`), Grand Battle (`*_epic_random_*`,
 * 30v30) and Frontline (`epic`). Everything else coexists on the random maps:
 * Random (`ctf`/`domination`/`assault`), Training (a Training Room can run on any
 * random map) and Onslaught (`comp7`). Clan Wars is not derivable here (its pool
 * is the live Global Map season) and is appended by the catalogue layer. */
export function battleTypesForArena(
  arenaId: string,
  gameplayTokens: string[],
  maxPlayersInTeam?: number,
): BattleType[] {
  // Event/mode variants keyed by arena-id suffix (Waffenträger `_wt`, Last Stand
  // `_ls26`/`_last_stand`) and the arcade "School" minigames: no standard
  // gameplay token, so they're matched by id.
  if (ARCADE_IDS.has(arenaId)) return [BattleType.Arcade];
  const variant = variantOf(arenaId);
  if (variant?.battleType) return [variant.battleType];
  // Single-player PvE Story Mode maps (Nebelburg/Operation Postman, Lauerberg,
  // Fallenstadt, Oder, Westwall, Omaha Beach): 1-player story-campaign missions,
  // never a PvP mode, even when a reused id carries a PvP token (Nebelburg is the
  // old Grand Battle id `212_epic_random_valley_sm25`). A team size of exactly 1
  // is the reliable tell (real PvP arenas are 15v15 or 30v30; 0 is `minimalArena`
  // "unknown", not PvE). Checked before the id-pattern rules below so a reused id
  // can't mislabel them.
  if (maxPlayersInTeam === 1) return [BattleType.StoryMode];
  // Dedicated PvP arenas, matched by id pattern.
  if (/(?:^|_)br_|battle_royale/.test(arenaId)) return [BattleType.BattleRoyale];
  if (/epic_random/.test(arenaId)) return [BattleType.GrandBattle];
  if (gameplayTokens.includes("epic")) return [BattleType.Frontline];
  const types: BattleType[] = [];
  if (gameplayTokens.some((t) => RANDOM_TOKENS.has(t))) {
    types.push(BattleType.Random);
    types.push(BattleType.Training);
  }
  if (gameplayTokens.includes("comp7")) types.push(BattleType.Onslaught);
  return types;
}
