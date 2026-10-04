import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import {
  GAME_NAME_FAMILIES,
  catalogueFilledPlaceholders,
  cataloguedCopy,
  cataloguedNames,
  duplicatedGameName,
  gameNames,
  isGameNamespace,
  missingGameName,
} from "../../../scripts/translation-rules";
import {
  jsonFiles,
  keysOf,
  LOCALES_DIR,
  readLocale,
  SOURCE_LOCALE,
  SRC_DIR,
  targetLocales,
  valueAt,
} from ".";

/**
 * The catalogues a helper owns, and the file allowed to read each one.
 *
 * `game/vocabulary` is a flat map of the game's own words, and two of its
 * families cannot be read straight: a battle type because one of its names is
 * built from another (`{onslaught} Night`), and a map mode because the key a
 * reader has is not always the key the catalogue holds (a geometry change
 * carries the client's raw `ctf`, the catalogue is keyed `standard`).
 */
const OWNED: { family: string; helper: string; why: string }[] = [
  {
    family: "battle-types",
    helper: "battleTypeName",
    why: "`battle-types.onslaught_night` is \"{onslaught} Night\", and only the helper fills that in. Read raw, it renders the placeholder at the reader.",
  },
  {
    family: "map-modes",
    helper: "mapModeName",
    why: "A mode arrives as the client's own token (`ctf`, `comp7`), which the catalogue does not carry. Read raw, it answers with the key and the caller falls back to English.",
  },
];

export function vocabularyTests() {
  describe("Locales vocabulary", () => {
    /**
     * Both bugs this catches shipped, and neither is visible in review.
     *
     * A raw read type-checks, lints, passes every other check in this suite and
     * renders in English or, worse, renders `Version {onslaught} de nuit` at a
     * French reader. The helpers' own JSDoc has always said everything goes
     * through them, and three call sites did not.
     */
    test("nothing reads the game's own catalogue behind its helper", () => {
      const offenders: string[] = [];
      // Resolved here rather than at module load: `SRC_DIR` lives in the
      // suite's own index, which imports this file, so reading it at the top
      // level runs before it is initialised.
      const home = path.join(SRC_DIR, "components", "game-name.ts");
      for (const file of tsFiles(SRC_DIR)) {
        if (path.resolve(file) === path.resolve(home)) continue;
        const source = fs.readFileSync(file, "utf-8");
        for (const { family, helper, why } of OWNED) {
          // Both spellings a call site uses: a template key built from a
          // variable, and a plain string key. The callee has to look like a
          // translate function, or the helper's own guard against an
          // unresolved key (`qualifier.startsWith("battle-types.")`) reads as
          // a read of the catalogue.
          const pattern = new RegExp(
            String.raw`(?<![.\w])t[A-Za-z]*\(\s*(?:\`${family}\.|["']${family}\.)`,
          );
          if (pattern.test(source))
            offenders.push(
              `${path.relative(SRC_DIR, file)} reads ${family}.* directly. Call ${helper}() instead: ${why}`,
            );
        }
      }
      assert.deepStrictEqual(offenders, []);
    });

    /**
     * The other half of the same rule, one layer down: the helpers above make
     * sure a component ASKS the catalogue, this makes sure the catalogue is
     * also what the prose around it says.
     *
     * A mode, a board and an award have exactly one name per language and it is
     * Wargaming's. Our own English writes those names inside ordinary sentences
     * and headings ("Stronghold boosts", "Onslaught Champion"), where nothing
     * marks them as the game's, so each one was translated on its own and came
     * back as a synonym: French read "Boosts de forteresse" above a table headed
     * "Bastion", and "Champion de l'Assaut" beside a board headed "Offensive".
     * Nothing else in this suite can see it. The string is grammatical, the
     * placeholders survive, the key exists in all 36, and only a player who
     * opens their own game knows the site is using a word it does not have.
     *
     * The writer enforces the same rule from the same module
     * (`scripts/translation-rules`), so a run fixes what this reports rather
     * than leaving it to be corrected by hand thirty-five times.
     */
    test("prose calls the game's own things by the game's own name", () => {
      const source = vocabularyOf(SOURCE_LOCALE);
      const filled = catalogueFilledPlaceholders(
        tsFiles(SRC_DIR).map((file) => fs.readFileSync(file, "utf-8")),
      );
      const offenders: string[] = [];
      for (const locale of targetLocales) {
        const names = gameNames(source, vocabularyOf(locale));
        if (names.length === 0) continue;
        for (const file of jsonFiles(path.join(LOCALES_DIR, locale))) {
          // Split the way the writer's guard does rather than on `path.sep`,
          // which is what the sibling checks in this folder compare against and
          // is the same separator `jsonFiles` is asked for.
          if (isGameNamespace(file.split(path.sep).join("/"))) continue;
          let english: Record<string, unknown>;
          let current: Record<string, unknown>;
          try {
            english = readLocale(SOURCE_LOCALE, file);
            current = readLocale(locale, file);
          } catch {
            // A file English has dropped, or one this locale has yet to be
            // given. Both are somebody else's check in this same suite.
            continue;
          }
          for (const key of keysOf(current)) {
            const from = valueAt(english, key);
            const value = valueAt(current, key);
            if (from === undefined || value === undefined) continue;
            const missed = missingGameName(from, value, names);
            if (missed)
              offenders.push(
                `${locale}/${file} :: ${key}: "${value}" does not say "${missed.own}", which is what the game calls "${missed.english}"`,
              );
            // The same rule's other half. A heading composed from the catalogue
            // can no longer say the wrong word, and can now say the right one
            // twice: the placeholder is filled in before a reader sees the
            // string, so a translation that also spells the name out prints it
            // both times. Ukrainian answered "Посилення укріпрайону
            // {stronghold}", which renders as "Посилення укріпрайону
            // Укріпрайон", and nothing else here can see it: the placeholder
            // survived and the name is present, so both of the checks that
            // would look pass it.
            const doubled = duplicatedGameName(from, value, names, filled);
            if (doubled)
              offenders.push(
                `${locale}/${file} :: ${key}: "${value}" writes "${doubled.own}" beside the {${doubled.token}} that already holds it`,
              );
          }
        }
      }
      assert.deepStrictEqual(offenders, []);
    });

    /**
     * The same rule where the string is nothing but the name, which is where it
     * shipped.
     *
     * The check above holds a SENTENCE to the name it contains and allows for
     * inflection, because a name has to agree with the words around it. A row
     * label has no words around it, and that is exactly what made it fail: "3
     * marks" alone reads as a score rather than as the marks on a gun, so the
     * model answered with one. French read "3 points" in the tank page's marks
     * panel, directly under a heading its own catalogue renders "Marques
     * d'excellence", and German, Italian, Turkish, Greek, Thai, Vietnamese,
     * Korean and Chinese all did the same. Seventeen stat labels were
     * catalogued names translated a second time, and the two files disagreed on
     * 127 strings across the thirty-five translated languages.
     *
     * So a prose string that IS a catalogued name has to be the catalogue's own
     * word, exactly. The writer no longer asks for these at all (`plan` copies
     * them like an identifier), which is what makes this check green rather than
     * a standing report, and the seventeen that caused it are gone from
     * `components/stat-labels` entirely: `composeStatLabels` reads them from the
     * catalogue at render time.
     *
     * Matched case-sensitively on the English, like the rule above and for the
     * same reason: "Random Battles" is the mode, and "Random battles" is a
     * phrase of ours that happens to contain it.
     */
    test("a prose string that is one of the game's names is the catalogue's own word", () => {
      const source = vocabularyOf(SOURCE_LOCALE);
      const offenders: string[] = [];
      for (const locale of targetLocales) {
        const names = cataloguedNames(source, vocabularyOf(locale));
        if (names.size === 0) continue;
        for (const file of jsonFiles(path.join(LOCALES_DIR, locale))) {
          if (isGameNamespace(file.split(path.sep).join("/"))) continue;
          let english: Record<string, unknown>;
          let current: Record<string, unknown>;
          try {
            english = readLocale(SOURCE_LOCALE, file);
            current = readLocale(locale, file);
          } catch {
            continue;
          }
          for (const key of keysOf(current)) {
            const from = valueAt(english, key);
            const value = valueAt(current, key);
            if (from === undefined || value === undefined) continue;
            const own = cataloguedCopy(from, names);
            if (own === undefined || own === value.trim()) continue;
            offenders.push(
              `${locale}/${file} :: ${key}: "${value}" for "${from}", which the game calls "${own}"`,
            );
          }
        }
      }
      assert.deepStrictEqual(offenders, []);
    });

    /**
     * What the check above cannot say anything about, and would be wrong to try.
     *
     * Several English names sit in more than one family, because the same mode
     * is a clan mode, a player mode and a feature at once. Nothing has ever
     * required the three cells to agree, and in two languages they do not:
     * Belarusian calls Skirmish both "Сутычка" and "Вылазка", Hindi both
     * "मुठभेड़" and "झड़प". A catalogue that has not made up its mind
     * cannot hold prose to a decision, so `gameNames` drops the name for that
     * language, which is safe and silent. This is what stops it being silent:
     * the reader sees two words for one mode on the site either way, and only a
     * person reading the file can settle which one the game actually uses.
     */
    test("the game's own catalogue names one thing once", () => {
      const source = vocabularyOf(SOURCE_LOCALE);
      const offenders: string[] = [];
      for (const locale of targetLocales) {
        const target = vocabularyOf(locale);
        const renderings = new Map<string, Map<string, string>>();
        for (const key of keysOf(source)) {
          const [family] = key.split(".");
          if (family === undefined || !GAME_NAME_FAMILIES.includes(family))
            continue;
          const english = valueAt(source, key);
          const own = valueAt(target, key);
          if (english === undefined || own === undefined) continue;
          if (english.includes("{")) continue;
          const held = renderings.get(english) ?? new Map<string, string>();
          held.set(own, key);
          renderings.set(english, held);
        }
        for (const [english, held] of renderings) {
          if (held.size < 2) continue;
          offenders.push(
            `${locale}/game/vocabulary.json: "${english}" is ${[...held]
              .map(([own, key]) => `"${own}" (${key})`)
              .join(" and ")}. One of them is what the game says.`,
          );
        }
      }
      assert.deepStrictEqual(offenders, []);
    });

    /**
     * The half of the catalogue that can be checked against Wargaming rather
     * than read on trust.
     *
     * The rule above makes `game/vocabulary` the word every translation naming
     * it has to use, which is only safe while the catalogue is right, and it is
     * written by a model for every language the game does not publish. Ten of
     * the twenty-two names are in the client's own gettext catalogues
     * (`locales/game-terms.json`, from `generate-game-locales`), in all
     * twenty-eight languages a client ships, so those are not a matter of
     * trust: they can simply be compared, and a run of this is what established
     * that the catalogue agrees with Wargaming on every single one.
     *
     * The other twelve are names the client never writes on their own
     * (Stronghold, Clan Wars, Common Test, the mastery classes), which is
     * exactly why they fell to a model in the first place and why the tree
     * carried five words for one mode. Nothing can check those but a player.
     *
     * The apostrophe is normalised before comparing: ours is U+2019 everywhere
     * outside `game/` by `typographic`, and the client writes the ASCII quote,
     * so "Traqueur d’acier" and "Traqueur d'acier" are the same word spelled to
     * two house styles rather than a disagreement.
     */
    test("the catalogue says what the client says, where the client says it", () => {
      const source = vocabularyOf(SOURCE_LOCALE);
      const client = clientTerms();
      const offenders: string[] = [];
      for (const locale of targetLocales) {
        const theirs = client[locale];
        if (!theirs) continue;
        const target = vocabularyOf(locale);
        for (const key of keysOf(source)) {
          const [family] = key.split(".");
          if (family === undefined || !GAME_NAME_FAMILIES.includes(family))
            continue;
          const english = valueAt(source, key);
          if (english === undefined) continue;
          const own = valueAt(target, key);
          const official = theirs[english];
          if (own === undefined || official === undefined) continue;
          if (straight(own) === straight(official)) continue;
          offenders.push(
            `${locale}/game/vocabulary.json :: ${key}: "${own}" where the client says "${official}"`,
          );
        }
      }
      assert.deepStrictEqual(offenders, []);
    });
  });
}

/** What the game itself calls a word, per language, keyed by the English. */
function clientTerms(): Record<string, Record<string, string>> {
  const file = path.join(LOCALES_DIR, "game-terms.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<
    string,
    Record<string, string>
  >;
}

/** One spelling of the apostrophe, so two house styles read as one word. */
const straight = (value: string): string =>
  value.replace(/\u2019/g, "'").trim();

/** One locale's `game/vocabulary`, or nothing where it has none yet. */
function vocabularyOf(locale: string): Record<string, unknown> {
  const file = path.join(LOCALES_DIR, locale, "game", "vocabulary.json");
  if (!fs.existsSync(file)) return {};
  return readLocale(locale, path.join("game", "vocabulary.json"));
}

/** Every `.ts`/`.tsx` under a directory, the way the sibling checks walk it. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "locales") continue;
      out.push(...tsFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}
