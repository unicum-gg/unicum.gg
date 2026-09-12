import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { LOCALES_DIR, SOURCE_LOCALE, jsonFiles, keysOf, readLocale } from ".";

/** The placeholders that hold a name nobody chose: a vehicle, a map, a player,
 * a clan. Their contents are proper nouns, so nothing about their spelling or
 * their sound can be known when the sentence is written. */
const PROPER_NOUN = /\{(tank|map|nickname|clan|player)\}/;

/**
 * The singular definite articles that would have to change with the name.
 *
 * Only the languages where the article elides or contracts before a vowel, and
 * only the singular: "les {tank}" is fine in French because the plural article
 * never elides. Catalan and Portuguese are left out deliberately, since neither
 * elides a bare article the way French and Italian do.
 */
const ARTICLES: Record<string, string[]> = {
  fr: ["le", "la"],
  it: ["il", "lo", "la"],
};

export function articlesTests() {
  describe("Locales articles", () => {
    /**
     * A bare article in front of a proper noun cannot be right for every name.
     *
     * French writes "l'IS-7" but "le T-34", and the sentence is written once
     * for all 1,236 vehicles, so whichever form it picks is wrong for a sixth
     * of them. No amount of data fixes that in the message: the message cannot
     * see the name. The fix is always the wording, either a preposition that
     * contracts ("du {tank}") or a sentence where nothing stands directly in
     * front of the name.
     *
     * Scoped to the languages where it is audible, and to the singular, so it
     * flags what a reader would actually notice.
     */
    test("no bare article sits in front of a proper noun", () => {
      const offenders: string[] = [];
      for (const file of jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE))) {
        const source = readLocale(SOURCE_LOCALE, file);
        const keys = keysOf(source).filter((key) => {
          const value = valueAt(source, key);
          return value !== undefined && PROPER_NOUN.test(value);
        });
        if (keys.length === 0) continue;

        for (const [locale, articles] of Object.entries(ARTICLES)) {
          if (!fs.existsSync(path.join(LOCALES_DIR, locale, file))) continue;
          const target = readLocale(locale, file);
          for (const key of keys) {
            const value = valueAt(target, key);
            if (!value) continue;
            const pattern = new RegExp(
              `\\b(${articles.join("|")})\\s+\\{(tank|map|nickname|clan|player)\\}`,
              "i",
            );
            const hit = value.match(pattern);
            if (hit)
              offenders.push(
                `${locale}/${file}: ${key} has "${hit[0]}" — ${JSON.stringify(value)}`,
              );
          }
        }
      }
      assert.deepStrictEqual(
        offenders,
        [],
        "A bare article before a proper noun is right for some names and wrong for others, and the message cannot tell them apart. Reword the English so the translation contracts the preposition instead.",
      );
    });
  });
}

function valueAt(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  let current: unknown = source;
  for (const segment of key.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}
