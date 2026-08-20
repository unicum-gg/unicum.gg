/**
 * The glossary's sections. They are the reader's filter on the index and a hub
 * page of their own, so each is broad enough to hold a few dozen terms and
 * narrow enough that a term belongs to exactly one. A term that plausibly fits
 * two (camouflage is a vision mechanic and a crew skill) is filed where a
 * player would look for it and reaches the other through its related terms.
 */
export enum GlossaryCategory {
  Vehicles = "vehicles",
  Gunnery = "gunnery",
  Armor = "armor",
  Mobility = "mobility",
  Vision = "vision",
  Crew = "crew",
  Progression = "progression",
  Economy = "economy",
  Ratings = "ratings",
  Statistics = "statistics",
  Modes = "modes",
  Tactics = "tactics",
  Slang = "slang",
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  GlossaryCategory.Vehicles,
  GlossaryCategory.Gunnery,
  GlossaryCategory.Armor,
  GlossaryCategory.Mobility,
  GlossaryCategory.Vision,
  GlossaryCategory.Crew,
  GlossaryCategory.Progression,
  GlossaryCategory.Economy,
  GlossaryCategory.Ratings,
  GlossaryCategory.Statistics,
  GlossaryCategory.Modes,
  GlossaryCategory.Tactics,
  GlossaryCategory.Slang,
];

export const GLOSSARY_CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  [GlossaryCategory.Vehicles]: "Vehicles",
  [GlossaryCategory.Gunnery]: "Gunnery",
  [GlossaryCategory.Armor]: "Armor",
  [GlossaryCategory.Mobility]: "Mobility",
  [GlossaryCategory.Vision]: "Vision",
  [GlossaryCategory.Crew]: "Crew",
  [GlossaryCategory.Progression]: "Progression",
  [GlossaryCategory.Economy]: "Economy",
  [GlossaryCategory.Ratings]: "Ratings",
  [GlossaryCategory.Statistics]: "Statistics",
  [GlossaryCategory.Modes]: "Battle modes",
  [GlossaryCategory.Tactics]: "Tactics",
  [GlossaryCategory.Slang]: "Slang",
};

/** One sentence per category, used as the hub page's intro and its meta
 * description. Written for a reader who landed on the hub from a search, so it
 * says what the section covers rather than what the site is. */
export const GLOSSARY_CATEGORY_DESCRIPTION: Record<GlossaryCategory, string> = {
  [GlossaryCategory.Vehicles]:
    "The vehicles themselves: the five classes, the ten tiers, and what makes a tank premium, reward or wheeled.",
  [GlossaryCategory.Gunnery]:
    "Everything a gun does: damage, penetration, accuracy, dispersion, reload and the shell types behind them.",
  [GlossaryCategory.Armor]:
    "How shells are stopped: armor thickness, angling, overmatch, normalization, spaced armor and module damage.",
  [GlossaryCategory.Mobility]:
    "How a vehicle moves: power-to-weight, terrain resistance, traverse, top speed and the physics behind them.",
  [GlossaryCategory.Vision]:
    "Spotting and concealment: view range, camouflage, render range, bushes and the rules that decide who sees whom.",
  [GlossaryCategory.Crew]:
    "Crew roles, training, skills and perks, and the equipment and consumables that change what a vehicle does.",
  [GlossaryCategory.Progression]:
    "Researching and upgrading: tech trees, experience, blueprints, modules and the vehicle tiers.",
  [GlossaryCategory.Economy]:
    "Credits, experience and the things that multiply them: premium, boosters, shell costs and service fees.",
  [GlossaryCategory.Ratings]:
    "The player rating systems: WN8, WN7, WNX, personal rating and what each one actually measures.",
  [GlossaryCategory.Statistics]:
    "The numbers a stats site tracks: win rate, damage per game, DPM, marks and the averages they are read against.",
  [GlossaryCategory.Modes]:
    "The formats you can queue for: Random Battles, Clan Wars, Strongholds, Onslaught, Frontline and the rest.",
  [GlossaryCategory.Tactics]:
    "The moves players name: hull down, sidescraping, peek-a-boo, trading and holding a flank.",
  [GlossaryCategory.Slang]:
    "The words the community uses that the game never prints: unicum, seal clubbing, tomato, HE spam and friends.",
};

export function isGlossaryCategory(value: string): value is GlossaryCategory {
  return (GLOSSARY_CATEGORIES as readonly string[]).includes(value);
}
