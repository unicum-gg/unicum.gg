import { REPO } from "./mirror";
import { parsePo } from "./localization";

// The game's own words, in every language World of Tanks is played in.
//
// Wargaming translates the game itself, so a map, a game mode, a nation and a
// badge already have a name a player reads in their own client. The public API
// serves thirteen languages and its `encyclopedia/arenas` is empty, so the maps
// are not in it at all. The client is where they live, and the launcher's own
// mechanism is what reaches them: the update service serves the locale part per
// language, so one build answers with a different package for each.
//
// The mirror publishes the result on a branch of its own rather than under a
// client: no single client ships every language (Europe's twenty-four come from
// the EU build, the Asian ones from Asia, American Spanish and Portuguese from
// NA, mainland Chinese from the 360 build), so this is their union.

/** The mirror branch carrying the per-language catalogues. */
export const GAME_LOCALES_BRANCH = "LOCALES";

/**
 * The languages the branch publishes, as directory names.
 *
 * The set is the clients' own `supported_languages`, not a wish list: a language
 * absent here is one no World of Tanks client ships, so there is no official
 * wording to read and a translation of ours is the only one that exists.
 */
export enum GameLanguage {
  Bulgarian = "bg",
  Czech = "cs",
  Danish = "da",
  German = "de",
  Greek = "el",
  English = "en",
  Spanish = "es",
  SpanishLatam = "es_ar",
  Finnish = "fi",
  French = "fr",
  Croatian = "hr",
  Hungarian = "hu",
  Italian = "it",
  Japanese = "ja",
  Korean = "ko",
  Lithuanian = "lt",
  Latvian = "lv",
  Dutch = "nl",
  Norwegian = "no",
  Polish = "pl",
  Portuguese = "pt",
  PortugueseBrazil = "pt_br",
  Romanian = "ro",
  Russian = "ru",
  Serbian = "sr",
  Swedish = "sv",
  Thai = "th",
  Turkish = "tr",
  Ukrainian = "uk",
  Vietnamese = "vi",
  ChineseSimplified = "zh_cn",
  ChineseSingapore = "zh_sg",
  ChineseTraditional = "zh_tw",
}

/**
 * The catalogues the branch publishes.
 *
 * Each is a file the site already reads by key from the English branch, so
 * naming them here is what lets the same key resolve in the reader's language.
 * `<nation>_vehicles` is deliberately absent: a tank's name is a proper noun
 * Wargaming does not translate (measured, 9 of 1,638 differ in French and none
 * of the nine is a translation), and neither are its module names.
 */
export enum GameCatalogue {
  /** Map names and descriptions, plus the game's name for each battle type. */
  Arenas = "arenas",
  /** Equipment, consumables, directives and field modifications. */
  Artefacts = "artefacts",
  /** Crew skills and perks. */
  CrewPerks = "crew_perks",
  /** The tier XI upgrade tree. */
  SkillTree = "veh_skill_tree",
  /** The client menu, whose `tank_params/` keys name a tank's statistics. */
  Menu = "menu",
  /** Onslaught's season names, which exist in no API. */
  Comp7 = "comp7.comp7_ext",
  /**
   * The client's own player profile, whose vocabulary our profile page is a
   * version of: the game already names most of what the page says.
   */
  Profile = "profile",
}

/** Raw-content URL of one gettext catalogue in one language. */
export function gameLocaleUrl(
  language: GameLanguage,
  catalogue: GameCatalogue | string,
): string {
  return `https://raw.githubusercontent.com/${REPO}/${GAME_LOCALES_BRANCH}/text/lc_messages/${language}/${catalogue}.po`;
}

/**
 * The `arenas` catalogue, split into the three things it names.
 *
 * One file holds both halves the site shows: every arena's name and blurb under
 * its own id, and the game's name for each battle type under `type/<mode>/name`
 * (which is how we know Onslaught is "Offensive" in French and "Natarcie" in
 * Polish). The keys are the client's raw tokens on both sides, so the caller
 * maps them to its own vocabulary rather than this module guessing at it.
 */
export type ArenaLocalization = {
  /** Arena id (`05_prohorovka`) to its name in this language. */
  maps: Record<string, string>;
  /** Arena id to its description, for the arenas that carry one. */
  descriptions: Record<string, string>;
  /** Client battle-type token (`comp7`, `ctf`, `epic`) to its name. */
  battleTypes: Record<string, string>;
};

const TYPE_PREFIX = "type/";

export function parseArenaCatalogue(text: string): ArenaLocalization {
  const entries = parsePo(text);
  const out: ArenaLocalization = { maps: {}, descriptions: {}, battleTypes: {} };
  for (const [key, value] of entries) {
    if (!value) continue;
    const slash = key.lastIndexOf("/");
    if (slash === -1) continue;
    const id = key.slice(0, slash);
    const field = key.slice(slash + 1);
    if (key.startsWith(TYPE_PREFIX)) {
      if (field === "name") out.battleTypes[id.slice(TYPE_PREFIX.length)] = value;
      continue;
    }
    if (field === "name") out.maps[id] = value;
    else if (field === "description") out.descriptions[id] = value;
  }
  return out;
}

/**
 * A catalogue that names things under `<key>/name`, with the blurb under
 * `<key>/descr`: `artefacts` and `crew_perks` are both shaped this way, and the
 * key is the one the tank payload already carries beside the English name.
 *
 * Only top-level ids are kept. `artefacts` also carries an `archetype/<id>/name`
 * sub-namespace naming a device FAMILY rather than a device, which nothing on
 * the wire is keyed by: a loadout item carries `additionalInvisibilityDevice`,
 * never `archetype/additionalInvisibilityDevice`. Keeping both would double the
 * file for entries no lookup can ever reach.
 */
export type NamedCatalogue = {
  names: Record<string, string>;
  descriptions: Record<string, string>;
};

export function parseNamedCatalogue(text: string): NamedCatalogue {
  const out: NamedCatalogue = { names: {}, descriptions: {} };
  for (const [key, value] of parsePo(text)) {
    if (!value) continue;
    const slash = key.lastIndexOf("/");
    if (slash === -1) continue;
    let id = key.slice(0, slash);
    // `crew_perks` files its blurbs one level down, under `<skill>/alt/…`, and
    // that is where all 48 of them live: dropping every nested id kept the
    // names and lost every description the client ships.
    if (id.endsWith("/alt")) id = id.slice(0, -"/alt".length);
    if (id.includes("/")) continue;
    const field = key.slice(slash + 1);
    if (field === "name") out.names[id] = value;
    // `short_special` first, and `descr` only where there is none.
    //
    // They are two different texts, not two spellings of one: `descr` is the
    // encyclopedia paragraph, written with the game's own `%(placeholder)s`
    // substitutions, while `short_special` is the one line a tooltip shows
    // ("Accelerates repairs, protects ammo rack, fuel tanks, and engine") and
    // carries no placeholder at all. The tooltip wants the second, and 85 of
    // them exist, translated into every language the client ships.
    else if (field === "short_special") out.descriptions[id] = value;
    else if (
      (field === "descr" || field === "description") &&
      out.descriptions[id] === undefined
    ) {
      out.descriptions[id] = value;
    }
  }
  return out;
}

const TANK_PARAMS_PREFIX = "tank_params/";

/**
 * The client's own name for each vehicle statistic, keyed by its parameter name
 * (`avgPiercingPower`, `circularVisionRadius`).
 *
 * Units and bare punctuation share the namespace (`mm`, `(s)`, `no_brackets/s`)
 * and are dropped: a caller wants the label of a statistic, not the symbol after
 * it, and the site renders its own units.
 */
/**
 * The tier-XI upgrade tree's own tooltips, keyed by the id the payload carries.
 *
 * `tooltips/description/<id>` is where the client keeps the sentence a field
 * modification shows ("Allows you to configure an alternative loadout of
 * equipment and directives"), and the id is exactly the key the site already
 * has on the feature, so the two meet with no mapping in between.
 */
export function parseSkillTreeDescriptions(text: string): Record<string, string> {
  return skillTreeTooltips(text, "description");
}

/**
 * The same tooltips' titles, under the same ids.
 *
 * A node carries both halves and they are read together, so publishing only the
 * sentence left every node NAMED in English under a description in the reader's
 * language, which reads worse than leaving both alone.
 */
export function parseSkillTreeNames(text: string): Record<string, string> {
  return skillTreeTooltips(text, "title");
}

function skillTreeTooltips(
  text: string,
  half: "title" | "description",
): Record<string, string> {
  const prefix = `tooltips/${half}/`;
  const out: Record<string, string> = {};
  for (const [key, value] of parsePo(text)) {
    if (value && key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
  }
  return out;
}

export function parseTankParams(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of parsePo(text)) {
    if (!key.startsWith(TANK_PARAMS_PREFIX) || !value) continue;
    const param = key.slice(TANK_PARAMS_PREFIX.length);
    if (param.includes("/")) continue;
    if (value.startsWith("(") || value.length < 2) continue;
    out[param] = value;
  }
  return out;
}

const BATTLE_TYPE_PREFIX = "headerButtons/battle/types/";

/**
 * The client's own name for each battle type, as its battle-type picker shows
 * it, keyed by the client's token (`battleRoyale`, `epic`, `ranked`).
 *
 * **Not the same vocabulary as `arenas`' `type/<x>/name`, and the difference is
 * not cosmetic.** That one labels an arena's gameplay type and is stale for at
 * least one mode: it calls `fallout` "Steel Hunt" ("Traque d'acier"), while the
 * picker a player actually clicks says "Steel Hunter" ("Traqueur d'acier",
 * "Stählerner Jäger"). Two different names, and the second is the mode's.
 *
 * So a caller reads the arenas catalogue for what a MAP is played as, and this
 * for what a MODE is called.
 */
export function parseBattleTypeNames(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of parsePo(text)) {
    if (!key.startsWith(BATTLE_TYPE_PREFIX) || !value) continue;
    const token = key.slice(BATTLE_TYPE_PREFIX.length);
    if (token.includes("/") || value.includes("%(")) continue;
    out[token] = value;
  }
  return out;
}

const SEASON_PREFIX = "seasonName/";

/**
 * Onslaught's season names, keyed by the ordinal the client releases them in
 * (`first`, `second`, `third`).
 *
 * The event board serves a season's dates and nothing else, so "Season of the
 * Azure Phoenix" exists only here. The client ships the whole year at once
 * rather than adding each as it goes live, which is why the live season is not
 * the last entry (see `SourceComp7Resource`).
 */
export function parseSeasonNames(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of parsePo(text)) {
    if (!key.startsWith(SEASON_PREFIX) || !value) continue;
    const ordinal = key.slice(SEASON_PREFIX.length);
    if (!ordinal.includes("/")) out[ordinal] = value;
  }
  return out;
}
