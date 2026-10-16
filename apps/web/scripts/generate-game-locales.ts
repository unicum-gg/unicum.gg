// Writes the game's own names for the maps and the modes, from the game, in
// every language it is played in.
//
// Wargaming's public API cannot answer this. Its `encyclopedia/arenas` has been
// empty for years, so it names no map at all, and it serves thirteen languages
// where the client is published in thirty-three. The client's own gettext
// catalogues carry both, and the mirror publishes them per language on its
// `LOCALES` branch (see `generate-locales.ts` there): one `arenas.po` holds
// every arena's name and description under its id, and the game's name for each
// battle type under `type/<token>/name`.
//
// That is how a French page can say "Abbaye" for Monastery and "Offensive" for
// Onslaught: not because a model guessed well, but because those are the words
// on the player's own screen.
//
// Companion to `generate-game-vocabulary`, which does the same job for the four
// namespaces the API does publish. Runs on `predev`/`prebuild`/`postinstall`
// and in the translations workflow, before the model does its half. Needs no
// credentials, only the network.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Precise subpaths, not the `@unicum.gg/shared` barrel: importing it whole runs
// its env validation, and naming maps needs no Wargaming application id.
import {
  BattleType,
} from "@unicum.gg/shared/wot/maps/battle-types";
import { MapGameMode } from "@unicum.gg/shared/wot/maps/game-modes";
import { TANK_AXIS_LABEL } from "@unicum.gg/shared/wot/tank-spec-fields";
import {
  GameCatalogue,
  gameLocaleUrl,
  parseArenaCatalogue,
  parseBattleMessages,
  parseChatCommands,
  parseBattleTypeNames,
  parseNamedCatalogue,
  parsePo,
  parseSeasonNames,
  parseSkillTreeDescriptions,
  parseSkillTreeNames,
  parseTankParams,
  type GameLanguage,
} from "@unicum.gg/wargaming";
import { GROUPS } from "../src/components/tanks/detail/specifications/characteristics/rows";
import {
  TANK_PARAM_BY_HEADING,
  TANK_PARAM_BY_ROW,
  tankHeadingKey,
} from "../src/lib/tank-params";
import {
  GAME_CLIENT_LANGUAGE,
  isGameClientNamespace,
} from "../src/lib/game-vocabulary";
import { DEFAULT_LOCALE, type Locale } from "../src/lib/translations";
import {
  GAME_OWNED_PATH,
  type GameOwnedKeys,
  typographic,
} from "./translation-rules";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesRoot = join(webRoot, "src", "locales");

/**
 * Our battle types, against the client's own token for the same mode.
 *
 * Only the ones the arenas catalogue names. `Random` is the rotation rather
 * than a mode and the client names it elsewhere; Clan Wars, the event modes and
 * our own Onslaught Night (built from Onslaught's name, see
 * `components/game-name`) have no entry here, so they stay with the translator.
 */
const BATTLE_TYPE_TOKEN: Partial<Record<BattleType, string>> = {
  [BattleType.Onslaught]: "comp7",
  [BattleType.Frontline]: "epic",
  [BattleType.GrandBattle]: "ctf30x30",
};

/**
 * The battle types whose name the ARENAS catalogue gets wrong, read from the
 * client's own battle-type picker instead.
 *
 * `arenas` labels an arena's gameplay type and is stale for Steel Hunter: it
 * says "Steel Hunt" ("Traque d'acier"), while the picker a player clicks says
 * "Steel Hunter" ("Traqueur d'acier", "Stählerner Jäger"). Two different names
 * in the same client, and the mode's is the second. Everything else agrees
 * between the two, so only the exception is listed here.
 */
const BATTLE_TYPE_MENU_TOKEN: Partial<Record<BattleType, string>> = {
  [BattleType.BattleRoyale]: "battleRoyale",
};

/** Our random-battle modes, against the client's gameplay token. */
const GAME_MODE_TOKEN: Record<MapGameMode, string> = {
  [MapGameMode.Standard]: "ctf",
  [MapGameMode.Encounter]: "domination",
  [MapGameMode.Assault]: "assault",
  [MapGameMode.AttackDefense]: "assault2",
};

type Json = Record<string, unknown>;

const localePath = (locale: Locale, namespace: string) =>
  join(localesRoot, locale, `${namespace}.json`);

function readJson(path: string): Json {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Json;
  } catch {
    return {};
  }
}

function writeJson(path: string, value: Json): boolean {
  const next = JSON.stringify(value, null, 2) + "\n";
  if (existsSync(path) && readFileSync(path, "utf-8") === next) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  return true;
}

/** Sort keys so a rebuild diffs on content rather than on catalogue order. */
const sorted = (entries: Record<string, string>): Json =>
  Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));

/**
 * A translated locale's file as the translator would leave it: sorted, and with
 * its apostrophes written the way `generate-translations` writes them.
 *
 * The client writes the ASCII quote and the translator rewrites every value of
 * every locale it merges with `typographic`, the ones it only carried over
 * included. Written verbatim here, every file holding an elision ("Région
 * d'Ensk") came back different on each install and went back on the next
 * translation run. English is left verbatim: the translator never writes it.
 */
const translated = (entries: Record<string, string>): Json =>
  Object.fromEntries(
    Object.entries(sorted(entries)).map(([key, value]) => [
      key,
      typographic(value as string),
    ]),
  );

/**
 * A local harvest to read instead of the published branch, as the mirror's own
 * `generate:locales --out` writes it. Set `GAME_LOCALES_DIR` to bring up a
 * language before the branch has been built with it, or to regenerate offline
 * from a mirror checkout. Unset, which is the normal case, reads the branch.
 */
const LOCAL_DIR = process.env.GAME_LOCALES_DIR;

async function read(
  language: GameLanguage,
  catalogue: GameCatalogue,
): Promise<string> {
  if (LOCAL_DIR) {
    const path = join(LOCAL_DIR, "text", "lc_messages", language, `${catalogue}.po`);
    if (!existsSync(path)) throw new Error(`${path}: not in the local harvest`);
    return readFileSync(path, "utf-8");
  }
  const url = gameLocaleUrl(language, catalogue);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

/** Everything one language contributes, from the catalogues that carry it. */
async function catalogueFor(language: GameLanguage) {
  const [
    arenas,
    artefacts,
    perks,
    menuText,
    comp7Text,
    skillTreeText,
    profile,
    chatCommands,
    battleMessages,
  ] =
    await Promise.all([
      read(language, GameCatalogue.Arenas).then(parseArenaCatalogue),
      read(language, GameCatalogue.Artefacts).then(parseNamedCatalogue),
      read(language, GameCatalogue.CrewPerks).then(parseNamedCatalogue),
      read(language, GameCatalogue.Menu),
      read(language, GameCatalogue.Comp7),
      read(language, GameCatalogue.SkillTree),
      // Optional: `profile` is the newest catalogue on the branch, and a
      // mirror that has not rebuilt since it was added must not stop the six
      // that have been there all along from being written.
      read(language, GameCatalogue.Profile)
        .then(parsePo)
        .catch(() => new Map<string, string>()),
      // Optional for the same reason as `profile`: a mirror that has not
      // rebuilt since this was added must not stop the ones that have been
      // there all along from being written.
      read(language, GameCatalogue.IngameGui)
        .then(parseChatCommands)
        .catch(() => ({}) as Record<string, string>),
      read(language, GameCatalogue.IngameGui)
        .then(parseBattleMessages)
        .catch(() => ({}) as Record<string, string>),
    ]);
  // One fetch, two vocabularies: the statistics table and the battle-type picker
  // both live in `menu`.
  return {
    arenas,
    artefacts,
    perks,
    menu: parseTankParams(menuText),
    modes: parseBattleTypeNames(menuText),
    seasons: parseSeasonNames(comp7Text),
    skillTree: parseSkillTreeDescriptions(skillTreeText),
    skillTreeNames: parseSkillTreeNames(skillTreeText),
    chatCommands,
    battleMessages,
    terms: termSource({
      profile,
      menu: parsePo(menuText),
      skillTree: parsePo(skillTreeText),
      comp7: parsePo(comp7Text),
    }),
  };
}

/**
 * The catalogues a term is allowed to come from, merged into one key space.
 *
 * Not every catalogue we read: `arenas` and `artefacts` name individual maps
 * and devices, which are already published as namespaces of their own and would
 * only crowd the sheet with proper nouns. What is wanted here is the client's
 * general vocabulary, the words it uses ABOUT the game: `profile` for the
 * statistics our player page mirrors, `menu` for the interface at large,
 * `veh_skill_tree` for the upgrade progression, `comp7` for Onslaught.
 *
 * The catalogue name prefixes the key because the two sides are matched by key,
 * and the same key ("title", "header") means something different in each.
 */
function termSource(catalogues: Record<string, Map<string, string>>) {
  const merged = new Map<string, string>();
  for (const [name, entries] of Object.entries(catalogues))
    for (const [key, value] of entries) merged.set(`${name}:${key}`, value);
  return merged;
}

/**
 * The words the game itself already has for what our pages say.
 *
 * Our pages are a version of the client's own screens, so most of their
 * vocabulary is not ours to invent: the client has a word for "Achievements" in
 * every language it ships in, and in French that word is "Faits d'armes", which
 * nobody reaches for from the English alone. Keyed by the ENGLISH string rather
 * than by the client's key, because our files are written in English and that is
 * the only thing the two sides share.
 *
 * Only short labels are kept. A sentence is prose, and prose is the site's own
 * voice: what is worth taking from the client is its nouns.
 */
const TERM_MAX_WORDS = 4;
const TERM_MAX_CHARS = 32;

function isTermLike(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= TERM_MAX_CHARS &&
    value.split(/\s+/).length <= TERM_MAX_WORDS &&
    !/[{}%\\]/.test(value) &&
    !value.includes("...")
  );
}

/**
 * One language's official word for each English label, resolved against the
 * ambiguity the catalogue really contains.
 *
 * The same English string appears under several keys and does not always come
 * back the same ("Go to Rating" is both "Aller au classement" and "Aller aux
 * classements"), so a term is taken only where the client is consistent about
 * it: the most frequent reading wins, and a tie is dropped rather than settled
 * by whichever key happened to be parsed first.
 */
function officialTerms(
  english: Map<string, string>,
  localized: Map<string, string>,
): Record<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const [key, source] of english) {
    const target = localized.get(key);
    if (!target || !isTermLike(source) || !isTermLike(target)) continue;
    const byValue = votes.get(source) ?? new Map<string, number>();
    byValue.set(target, (byValue.get(target) ?? 0) + 1);
    votes.set(source, byValue);
  }
  const out: Record<string, string> = {};
  for (const [source, byValue] of votes) {
    const ranked = [...byValue].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) continue;
    out[source] = ranked[0][0];
  }
  return out;
}

/**
 * Our characteristics table in the client's words, keyed by OUR row key so the
 * table reads `t(row.key)` and never has to know the client's naming.
 *
 * English is not taken from the client. Our labels are the site's own voice and
 * what the other locales are translated from, and the client writing "Average
 * Damage" where our column says "Damage" is not a correction. So this writes the
 * mapped rows for every other language, and the translator fills the rest.
 */
function tankParams(menu: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [row, param] of Object.entries(TANK_PARAM_BY_ROW)) {
    const label = menu[param];
    if (label) out[row] = label;
  }
  for (const [heading, param] of Object.entries(TANK_PARAM_BY_HEADING)) {
    const label = menu[param];
    if (label) out[tankHeadingKey(heading)] = label;
  }
  return out;
}

/**
 * The rows a translated `game/tank-params` already holds, limited to the ones
 * our English still has, so a row we dropped does not survive in the others.
 */
function keptRows(
  existing: Json,
  english: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (typeof value === "string" && Object.hasOwn(english, key)) out[key] = value;
  }
  return out;
}

/** The English side: our own labels, so the file the others translate from is
 * the table itself rather than a copy of it that can drift. */
function englishTankParams(): Record<string, string> {
  const out: Record<string, string> = {};
  // The axes a vehicle is compared on, which are the same words as the table's
  // own groups (Firepower, Mobility, Survivability) plus two of their own. The
  // similar-tanks verdict and the equipment slot categories read them, so they
  // live here rather than in a fourth copy of the vocabulary.
  for (const [axis, label] of Object.entries(TANK_AXIS_LABEL)) {
    out[tankHeadingKey(label)] = label;
    out[axis] = label;
  }
  for (const group of GROUPS) {
    out[tankHeadingKey(group.title)] = group.title;
    for (const row of group.rows) {
      // A row reads either a stored field (`key`) or a value derived from
      // several (`compute`, the effective speed and traverse). The derived ones
      // have no key, so they are keyed by their slugged label, like the
      // headings: "… hard" under Effective speed and under Terrain resistance
      // are the same word and share one entry.
      if (row.header || !row.key) out[tankHeadingKey(row.label)] = row.label;
      else out[row.key] = row.label;
    }
  }
  return out;
}

/**
 * The families whose entries are filled from the term sheet by their English
 * label, with no mapping of their own: our English IS the string the client is
 * matched on, so whatever the sheet decided for it is the game's own word for
 * that thing.
 *
 * `features` names what the site has a page about (`Upgrades` is the one the
 * tank page's progression panel is titled with; the rest fill in as the client
 * turns out to name them). `resources` names what an account holds, and exists
 * because a model left to itself writes "free XP" word for word in every
 * language, beside a tech tree the same player's client heads "Expérience
 * libre".
 */
const TERM_FILLED_FAMILIES = ["features", "resources"] as const;

/**
 * The two mode namespaces, merged into the locale's `game/vocabulary` rather
 * than written over it: that file also holds words the game has no name for,
 * which the translator wrote and which this must not erase. The client's names
 * win over whatever was there, which is the whole point of reading them.
 *
 * English is not touched. Our own English is the site's voice and the one the
 * API and the Discord bot answer with, and it is what the other locales are
 * translated from; the client saying "Standard Battle" where we say "Standard"
 * is not a correction.
 */
function mergeVocabulary(
  locale: Locale,
  battleTypes: Record<string, string>,
  /** The client's battle-type picker, for the names `arenas` gets wrong. */
  picker: Record<string, string>,
  /** This language's official terms, for the names carried in prose. */
  terms: Record<string, string>,
  /** Filled with the dotted path of every entry the client supplied. */
  owned: string[],
): boolean {
  const path = localePath(locale, "game/vocabulary");
  const vocabulary = readJson(path);
  const types: Record<string, string> = {
    ...((vocabulary["battle-types"] as Record<string, string>) ?? {}),
  };
  const modes: Record<string, string> = {
    ...((vocabulary["map-modes"] as Record<string, string>) ?? {}),
  };
  let changed = false;
  const english = readJson(localePath(DEFAULT_LOCALE, "game/vocabulary"));
  const filled: Record<string, Record<string, string>> = {};
  for (const family of TERM_FILLED_FAMILIES) {
    const own: Record<string, string> = {
      ...((vocabulary[family] as Record<string, string>) ?? {}),
    };
    for (const [key, label] of Object.entries(
      (english[family] ?? {}) as Record<string, string>,
    )) {
      // The client writes the ASCII quote and the rest of the tree writes
      // U+2019, so a name taken verbatim would spell its apostrophe one way
      // here and the other way two entries down, where the translator wrote it.
      // The comparison against the client already normalises before judging
      // ("Traqueur d'acier" and "Traqueur d’acier" are one word in two house
      // styles), but `cataloguedNames` does not: it sees one English name
      // rendered two ways, drops it, and the mechanical copy that keeps "3
      // Marques" out of a model's hands quietly stops applying to it.
      const official = terms[label];
      const name = official ? typographic(official) : undefined;
      if (name) owned.push(`${family}.${key}`);
      if (name && own[key] !== name) {
        own[key] = name;
        changed = true;
      }
    }
    filled[family] = own;
  }
  const named: [string, string | undefined][] = [
    ...Object.entries(BATTLE_TYPE_TOKEN).map(
      ([type, token]) =>
        [type, battleTypes[token]] as [string, string | undefined],
    ),
    ...Object.entries(BATTLE_TYPE_MENU_TOKEN).map(
      ([type, token]) => [type, picker[token]] as [string, string | undefined],
    ),
  ];
  const englishTypes = (english["battle-types"] ?? {}) as Record<string, string>;
  for (const [type, token] of named) {
    // The term sheet first, the catalogue token only where it has nothing. The
    // two are both the client, and can disagree: Romanian's battle-type picker
    // says "Vânător de oţel" while every other string of the client, and so
    // the sheet, says "Vânătorul de oţel". The locale suite holds the
    // vocabulary to the sheet, so the token's spelling was corrected by the
    // translator on every run and restored by this on every install.
    const label = englishTypes[type];
    const official = (label ? terms[label] : undefined) ?? token;
    const name = official ? typographic(official) : undefined;
    if (name) owned.push(`battle-types.${type}`);
    if (name && types[type] !== name) {
      types[type] = name;
      changed = true;
    }
  }
  for (const [mode, token] of Object.entries(GAME_MODE_TOKEN)) {
    const name = battleTypes[token] ? typographic(battleTypes[token]) : undefined;
    if (name) owned.push(`map-modes.${mode}`);
    if (name && modes[mode] !== name) {
      modes[mode] = name;
      changed = true;
    }
  }
  if (!changed) return false;
  return writeJson(path, {
    ...vocabulary,
    "battle-types": types,
    "map-modes": modes,
    ...filled,
  });
}

/**
 * Where the client's vocabulary is published for the translator to read.
 *
 * Beside `terms.json` rather than inside a locale folder, and for the same
 * reason: it is not a dictionary the site serves, it is what the translator is
 * told before it writes one. `generate-locales` bundles `<locale>/**` only, so
 * nothing here reaches a browser.
 */
const GAME_TERMS_PATH = join(localesRoot, "game-terms.json");

/**
 * The namespaces this writes that also hold words the client has no name for,
 * so the translator still fills and refreshes their model-written half.
 *
 * `game/tank-params` keeps our own English and takes the client's label only
 * for the rows it maps; `game/vocabulary` is merged into rather than written
 * over. Everything else here is the client's alone, and is listed in
 * `GAME_CLIENT_NAMESPACES`.
 */
const MIXED_NAMESPACES = new Set(["game/tank-params", "game/vocabulary"]);

async function main(): Promise<void> {
  const entries = Object.entries(GAME_CLIENT_LANGUAGE) as [Locale, GameLanguage][];
  let written = 0;
  let reached = 0;

  const failures: string[] = [];
  // The English catalogue is the key side of the term sheet: every other
  // language is matched to it by client key, then published under the English
  // string, which is what our own files are written in.
  let englishTerms: Map<string, string> | null = null;
  try {
    const englishClient = GAME_CLIENT_LANGUAGE[DEFAULT_LOCALE];
    if (!englishClient) throw new Error("no client language for the default locale");
    englishTerms = (await catalogueFor(englishClient)).terms;
  } catch (error) {
    failures.push(`en/terms: ${String(error)}`);
  }
  const gameTerms: Record<string, Record<string, string>> = {};
  // The sheet a previous run committed, which is what a language the branch
  // cannot answer for is filled from today.
  //
  // The rule above says a branch that has never been built must not empty the
  // files a previous run wrote, and this is its other half: a name CATALOGUED
  // today must still reach every language on a day the mirror is down, or it
  // falls to the model and comes back as the invented word the catalogue exists
  // to replace. The sheet is in the repository and is the last thing the game
  // said, so it answers the same question as the branch, one build later.
  const committedTerms = readJson(GAME_TERMS_PATH) as Record<
    string,
    Record<string, string>
  >;
  // Which entries of the mixed namespaces the client wrote, per language. Starts
  // from the committed manifest so a language the branch cannot answer for today
  // keeps the claim a previous run made, exactly as its files are kept.
  const owned = readJson(GAME_OWNED_PATH) as GameOwnedKeys;
  const englishParams = englishTankParams();

  for (const [locale, language] of entries) {
    let catalogue: Awaited<ReturnType<typeof catalogueFor>> | null = null;
    try {
      catalogue = await catalogueFor(language);
    } catch (error) {
      // One language failing must not drop the others. Held back rather than
      // printed here: every language failing is one fact (the branch is
      // unreachable), not twenty-two, and this runs on every install.
      failures.push(`${locale}: ${String(error)}`);
    }
    const clientParams =
      catalogue && locale !== DEFAULT_LOCALE ? tankParams(catalogue.menu) : {};
    if (catalogue) {
      reached++;
      for (const [namespace, value] of [
        ["game/maps", catalogue.arenas.maps],
        ["game/map-descriptions", catalogue.arenas.descriptions],
        ["game/equipment", catalogue.artefacts.names],
        // The blurb under the name, from the same catalogue: the parser already
        // read it, and a tooltip that names a device in French and then explains
        // it in English is half-translated.
        ["game/equipment-descriptions", catalogue.artefacts.descriptions],
        ["game/crew-perks", catalogue.perks.names],
        // The paragraph under the skill's name, from the same catalogue.
        ["game/crew-perk-descriptions", catalogue.perks.descriptions],
        // The upgrade tree's own tooltips, both halves: a node named in English
        // under a sentence in the reader's language is worse than neither.
        ["game/skill-tree", catalogue.skillTreeNames],
        ["game/skill-tree-descriptions", catalogue.skillTree],
        ["game/onslaught-seasons", catalogue.seasons],
        // The quick commands a replay records as an action id, in the words the
        // client itself puts on screen. Keyed by the command table's `msgText`,
        // which is the only name both halves share.
        ["game/chat-commands", catalogue.chatCommands],
        // The battle feed's own words for a destruction, which a replay carries
        // only as a reason code.
        ["game/battle-messages", catalogue.battleMessages],
        // English keeps our own labels; every other language gets the client's.
        //
        // Merged into what is there rather than written over it: the client
        // names only the rows it has a parameter for (about a third), and the
        // rest are the translator's. Written over, every install dropped those
        // rows and the next translation run bought them back from the model.
        [
          "game/tank-params",
          locale === DEFAULT_LOCALE
            ? englishParams
            : {
                ...keptRows(
                  readJson(localePath(locale, "game/tank-params")),
                  englishParams,
                ),
                ...clientParams,
              },
        ],
      ] as const) {
        // A namespace this writes is either the client's alone or mixed with our
        // own words, and the translator behaves differently for each. Classifying
        // it is not optional: an unclassified one silently gets the mixed rule,
        // which is what let a model rewrite the client's own sentences.
        if (!isGameClientNamespace(namespace) && !MIXED_NAMESPACES.has(namespace)) {
          throw new Error(
            `[game-locales] ${namespace} is written here but classified neither in GAME_CLIENT_NAMESPACES nor as mixed`,
          );
        }
        const shaped = locale === DEFAULT_LOCALE ? sorted(value) : translated(value);
        if (writeJson(localePath(locale, namespace), shaped)) {
          written++;
          console.log(`[game-locales] ${locale}/${namespace}`);
        }
      }
    }
    if (locale === DEFAULT_LOCALE) continue;
    const vocabularyOwned: string[] = [];
    const read =
      catalogue && englishTerms
        ? officialTerms(englishTerms, catalogue.terms)
        : null;
    if (read) gameTerms[locale] = read;
    const terms = read ?? committedTerms[locale] ?? {};
    if (
      mergeVocabulary(
        locale,
        catalogue?.arenas.battleTypes ?? {},
        catalogue?.modes ?? {},
        terms,
        vocabularyOwned,
      )
    ) {
      written++;
      console.log(`[game-locales] ${locale}/game/vocabulary (modes)`);
    }
    if (catalogue) {
      owned[locale] = {
        "game/tank-params": Object.keys(clientParams).sort(),
        "game/vocabulary": [...new Set(vocabularyOwned)].sort(),
      };
    }
  }

  if (reached === 0) {
    console.warn(
      `[game-locales] no language could be read (${failures[0] ?? "no language configured"}), keeping the committed files and filling the catalogue from the committed term sheet`,
    );
    return;
  }
  const sortedOwned = Object.fromEntries(
    Object.keys(owned)
      .sort()
      .map((locale) => [locale, owned[locale]]),
  );
  if (writeJson(GAME_OWNED_PATH, sortedOwned)) {
    written++;
    console.log("[game-locales] game-owned.json");
  }
  if (Object.keys(gameTerms).length > 0) {
    const sortedTerms = Object.fromEntries(
      Object.keys(gameTerms)
        .sort()
        .map((locale) => [locale, sorted(gameTerms[locale])]),
    );
    if (writeJson(GAME_TERMS_PATH, sortedTerms)) {
      written++;
      const count = Object.values(gameTerms).reduce(
        (total, terms) => total + Object.keys(terms).length,
        0,
      );
      console.log(
        `[game-locales] game-terms.json: ${count} official term(s) across ${Object.keys(gameTerms).length} language(s)`,
      );
    }
  }
  for (const failure of failures) console.error(`[game-locales] ${failure}`);
  console.log(
    written
      ? `[game-locales] wrote ${written} file(s) across ${reached} language(s)`
      : "[game-locales] up to date",
  );
}

main().catch((error) => {
  console.error("[game-locales] failed:", error);
  process.exit(1);
});
