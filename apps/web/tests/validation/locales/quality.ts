import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { isGameClientNamespace } from "../../../src/lib/game-vocabulary";
import { shouts } from "../../../scripts/translation-rules";
import {
  jsonFiles,
  keysOf,
  LOCALES_DIR,
  readLocale,
  SOURCE_LOCALE,
  targetLocales,
} from ".";

const TAG = /<[^>]+>/g;

/**
 * The placeholders a message depends on.
 *
 * Not a regex, because an ICU argument nests: `/\{[^}]+\}/` stops at the first
 * closing brace, so `{count, plural, one {# battle} other {# battles}}` yields
 * `{count, plural, one {# battle}` and its French twin yields its own
 * translated fragment. The two never match and every pluralised key reads as a
 * lost placeholder.
 *
 * A branch's CONTENT is prose and is walked rather than counted: the branches
 * differ between languages by design, and Polish needs three where English
 * needs two.
 */
function placeholders(text: string): string[] {
  const out: string[] = [];

  const closing = (input: string, open: number): number => {
    let depth = 0;
    for (let i = open; i < input.length; i++) {
      if (input[i] === "{") depth++;
      else if (input[i] === "}" && --depth === 0) return i;
    }
    return -1;
  };

  const walk = (input: string) => {
    let cursor = 0;
    while (cursor < input.length) {
      const open = input.indexOf("{", cursor);
      if (open === -1) return;
      const close = closing(input, open);
      if (close === -1) return;

      const body = input.slice(open + 1, close);
      const first = body.indexOf(",");
      const second = first === -1 ? -1 : body.indexOf(",", first + 1);
      const keyword =
        second === -1 ? undefined : body.slice(first + 1, second).trim();

      if (keyword === "plural" || keyword === "select") {
        out.push(`{${body.slice(0, first).trim()}}`);
        let scan = second + 1;
        while (scan < body.length) {
          const branchOpen = body.indexOf("{", scan);
          if (branchOpen === -1) break;
          const branchClose = closing(body, branchOpen);
          if (branchClose === -1) break;
          walk(body.slice(branchOpen + 1, branchClose));
          scan = branchClose + 1;
        }
      } else {
        out.push(`{${body.trim()}}`);
      }

      cursor = close + 1;
    }
  };

  walk(text);
  return out;
}

const tags = (text: string): string[] => text.match(TAG) ?? [];

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

/**
 * What a translation is not allowed to lose.
 *
 * A `{placeholder}` is substituted at render time, by `t` for a value and by
 * `Interpolate` for a React node, so one dropped in translation is a control
 * that never renders and a sentence missing its subject. An HTML tag is markup
 * the string is rendered with. Both are invisible in review and only surface on
 * the page, in a language nobody on the team reads.
 */
export function qualityTests() {
  const sourceFiles = jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE));

  describe("Locales quality", () => {
    test("placeholders and tags survive translation", () => {
      const issues: string[] = [];
      for (const file of sourceFiles) {
        const source = readLocale(SOURCE_LOCALE, file);
        const keys = keysOf(source);
        for (const locale of targetLocales) {
          if (!fs.existsSync(path.join(LOCALES_DIR, locale, file))) continue;
          const target = readLocale(locale, file);
          for (const key of keys) {
            const from = valueAt(source, key);
            const to = valueAt(target, key);
            if (!from || !to) continue;
            for (const [label, extract] of [
              ["placeholder", placeholders],
              ["tag", tags],
            ] as const) {
              // Compared as SETS, not as lists. What breaks a sentence is a
              // placeholder the target has LOST (it renders with a hole in it)
              // or one it INVENTED (nothing supplies it, so the reader sees the
              // braces). How many times a language repeats one it was given is
              // its own business: Kazakh names the rank twice in a sentence
              // where English names it once, and both render.
              const expected = [...new Set(extract(from))].sort();
              const actual = [...new Set(extract(to))].sort();
              if (expected.join("|") !== actual.join("|"))
                issues.push(
                  `${locale}/${file}: ${key} ${label}s ${JSON.stringify(expected)} became ${JSON.stringify(actual)}`,
                );
            }
          }
        }
      }
      assert.deepStrictEqual(issues, []);
    });
  
    /**
     * A leading or trailing space belongs in the markup, not in the string.
     *
     * Measured rather than assumed: of the four English strings that carried
     * one when this was written, every single one came back from the model
     * without it, in French. The reader then sees "Après :Zone" or a tag glued
     * to the word before it, and nothing in review shows it because English is
     * the one language where the space is still there. The game's own
     * catalogues are exempt: those strings are Wargaming's, copied verbatim,
     * and one of them really does end in a space.
     */
    test("no English string leans on an edge space", () => {
      const offenders: string[] = [];
      for (const file of jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE))) {
        const namespace = file.replace(/\.json$/, "");
        if (isGameClientNamespace(namespace)) continue;
        const source = readLocale(SOURCE_LOCALE, file);
        for (const key of keysOf(source)) {
          const value = valueAt(source, key);
          if (value && value !== value.trim())
            offenders.push(`${file}: ${key} = ${JSON.stringify(value)}`);
        }
      }
      assert.deepStrictEqual(
        offenders,
        [],
        "A translator drops an edge space, so the space has to live in the JSX beside the call.",
      );
    });

    /**
     * The apostrophe is one character, and it is not the one on the keyboard.
     *
     * French elides ("l’IS-7"), English contracts ("doesn’t"), Turkish suffixes
     * a symbol ("3 €’dan"), and all three want U+2019, the typographic
     * apostrophe, not U+0027, the ASCII vertical quote a programmer's keyboard
     * offers. The model writes whichever it feels like, so the tree carried both
     * spellings in the same sentence, and the mix is only visible when two
     * strings sit next to each other on a page.
     *
     * The English side matters most: it is what the other thirty-five are
     * written from, so a source with a straight quote teaches the model to
     * answer with one. The game's own catalogues are exempt for the same reason
     * as above, those strings are Wargaming's and are copied as they come.
     */
    test("the apostrophe is typographic, in every language", () => {
      const offenders: string[] = [];
      for (const locale of [SOURCE_LOCALE, ...targetLocales])
        for (const file of jsonFiles(path.join(LOCALES_DIR, locale))) {
          // The whole `game/` tree is exempt, not only the catalogues the
          // client writes wholesale: a file there mixes Wargaming's own wording
          // with ours (the words the game has no name for), and nothing in it
          // marks which is which. "Traqueur d’acier" is the game's French for
          // Steel Hunter and "м'який" is the client's Ukrainian, both copied as
          // they came, so the rule cannot be applied key by key.
          if (file.startsWith("game/")) continue;
          if (!fs.existsSync(path.join(LOCALES_DIR, locale, file))) continue;
          const target = readLocale(locale, file);
          for (const key of keysOf(target)) {
            const value = valueAt(target, key);
            if (value?.includes("'"))
              offenders.push(`${locale}/${file}: ${key} = ${JSON.stringify(value)}`);
          }
        }
      assert.deepStrictEqual(
        offenders,
        [],
        "Write the apostrophe as \u2019 (\u2019), not as the ASCII quote.",
      );
    });

    /**
     * A translation must not shout when its source does not.
     *
     * The game writes some of its own headings in capitals, and the model
     * copies that habit into strings the interface styles itself: "Grand Final"
     * came back as "GRANDE FINALE", "GROSSES FINALE" and "\u0412\u0415\u041b\u0418\u041a\u0418 \u0424\u0418\u041d\u0410\u041b" in one run.
     * Nothing in review catches it, because English is the one language where
     * the string still reads normally.
     *
     * Only flagged when the English is NOT itself all-caps, so a source that
     * really is an acronym or a shouted label keeps its translations. Four
     * letters is the floor, below which a short word ("WN8", "EU") is an
     * abbreviation rather than a raised voice.
     */
    test("no translation shouts where English does not", () => {
      const offenders: string[] = [];
      for (const locale of targetLocales)
        for (const file of jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE))) {
          if (file.startsWith("game/")) continue;
          if (!fs.existsSync(path.join(LOCALES_DIR, locale, file))) continue;
          const source = readLocale(SOURCE_LOCALE, file);
          const target = readLocale(locale, file);
          for (const key of keysOf(source)) {
            const from = valueAt(source, key);
            const to = valueAt(target, key);
            if (from && to && shouts(to, from))
              offenders.push(`${locale}/${file}: ${key} = ${JSON.stringify(to)}`);
          }
        }
      assert.deepStrictEqual(
        offenders,
        [],
        "Capitalisation is the interface's job. Write the words, not the styling.",
      );
    });
});
}
