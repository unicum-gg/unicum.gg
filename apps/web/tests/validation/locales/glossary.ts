import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import {
  GLOSSARY_TERM_LOCALES,
  KNOWN_CATALOGUE_ERRORS,
  glossaryEntries,
  glossaryTerms,
  glossaryTitle,
} from "../../../scripts/glossary-terms";
import { cataloguedNames } from "../../../scripts/translation-rules";
import {
  GENERATED_DIR,
  jsonFiles,
  keysOf,
  LOCALES_DIR,
  readLocale,
  SOURCE_LOCALE,
  targetLocales,
  valueAt,
} from ".";

/** One spelling of the apostrophe: the glossary writes the keyboard's and the
 * interface U+2019, which is a house style rather than a disagreement. */
const straight = (value: string): string => value.replace(/’/g, "'").trim();

function vocabularyOf(locale: string): Record<string, unknown> {
  const file = path.join(LOCALES_DIR, locale, "game", "vocabulary.json");
  if (!fs.existsSync(file)) return {};
  return readLocale(locale, path.join("game", "vocabulary.json"));
}

export function glossaryTests() {
  describe("Locales glossary", () => {
    /**
     * A tooltip and the label it hangs off are one reading, so they must use
     * one word. The interface and the glossary were translated by two scripts
     * that never read each other, and a French table headed "Moy. niveau" sat
     * under a tooltip titled "Rang moyen". The translator now takes the
     * glossary's title as a decided term (`glossary-terms.ts`), and this is
     * what holds it to that, for the labels that are nothing but the term.
     *
     * Only where the glossary is trusted to decide, and never against the
     * game's own name, which outranks it on both sides.
     */
    test("a label naming a glossary entry uses the entry's title", () => {
      const source = vocabularyOf(SOURCE_LOCALE);
      const offenders: string[] = [];
      for (const locale of GLOSSARY_TERM_LOCALES) {
        const terms = glossaryTerms(locale);
        const names = cataloguedNames(source, vocabularyOf(locale));
        for (const file of jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE))) {
          if (file.startsWith(`game${path.sep}`) || file.startsWith(GENERATED_DIR))
            continue;
          const target = path.join(LOCALES_DIR, locale, file);
          if (!fs.existsSync(target)) continue;
          const english = readLocale(SOURCE_LOCALE, file);
          const theirs = readLocale(locale, file);
          for (const key of keysOf(english)) {
            const from = valueAt(english, key)?.trim();
            if (!from || names.has(from)) continue;
            const want = terms.get(from);
            const have = valueAt(theirs, key);
            if (want === undefined || have === undefined) continue;
            if (straight(have) !== straight(want))
              offenders.push(`${locale}/${file} :: ${key}: "${have}" where the glossary says "${want}"`);
          }
        }
      }
      assert.deepStrictEqual(offenders, []);
    });

    /**
     * The other direction: a glossary entry about one of the game's own names
     * is titled with it. Applies to every language, since the catalogue is the
     * authority everywhere and a title left in English ("Onslaught" on a
     * Spanish page whose board reads "Asedio") is the same contradiction.
     */
    test("a glossary entry about a game name is titled with it", () => {
      const source = vocabularyOf(SOURCE_LOCALE);
      const english = glossaryEntries(SOURCE_LOCALE);
      const offenders: string[] = [];
      for (const locale of targetLocales) {
        const names = cataloguedNames(source, vocabularyOf(locale));
        for (const [entry, file] of glossaryEntries(locale)) {
          const sourceFile = english.get(entry);
          if (!sourceFile) continue;
          const from = glossaryTitle(fs.readFileSync(sourceFile, "utf-8"));
          const own = from ? names.get(from) : undefined;
          if (own === undefined || KNOWN_CATALOGUE_ERRORS.has(`${locale}:${from}`))
            continue;
          const title = glossaryTitle(fs.readFileSync(file, "utf-8")) ?? "";
          if (straight(title) !== straight(own))
            offenders.push(`${locale}/${entry}: "${title}" where the game says "${own}"`);
        }
      }
      assert.deepStrictEqual(offenders, []);
    });
  });
}

