/**
 * The glossary's titles as a term sheet, for the interface translator.
 *
 * The interface and the glossary were translated by two scripts that never read
 * each other, so a table headed "Moy. niveau" sat under a tooltip titled "Rang
 * moyen" and a French reader was shown two words for one statistic. Both say
 * the same thing now because the interface takes the glossary's word.
 *
 * The glossary wins over the model's own sheet and over the client match, and
 * the reason is context: a sheet term was decided from a bare word, and the
 * client is matched by English string across whatever screen happened to use
 * it ("Reload" is the button "Recharger", a verb, in French), while a glossary
 * title was written with its whole definition underneath it. Measured on
 * French, the glossary is the right one of the pair almost every time they
 * disagree: "Points de structure" against "Points de vie", "Vitesse de rotation
 * de la tourelle" against "Rotation de la tourelle". It still loses to
 * `game/vocabulary`, which names the game's modes and is corrected by hand.
 *
 * Only for the languages whose glossary was written by the larger model. The
 * others were written by a small one and it shows in exactly the words that
 * matter: Spanish and Italian titled the tier entry "Tier" in English, and Greek
 * called it "Τάξη", which is a vehicle class. Promoting those to an authority
 * would spread them, so they stay what the model wrote until somebody rewrites
 * them.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isIdentifier, typographic } from "./translation-rules";

export const GLOSSARY_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "content",
  "glossary",
);

/** The languages whose glossary was written by the larger model, and is
 * therefore trusted to decide the interface's words. */
export const GLOSSARY_TERM_LOCALES: readonly string[] = [
  "fr",
  "de",
  "pl",
  "uk",
  "ru",
  "cs",
];

/**
 * Where the glossary is right and the catalogue is not, so the title is kept.
 *
 * Russian and Ukrainian took "Ranked Battles" from a client string that names
 * the retired 10x10 ladder ("Игра в Ладдере"), where the client's own singular
 * is "Ранговый бой". The catalogue cannot be corrected without the check that
 * holds it to the client failing, so the glossary keeps the right word until
 * that check learns the difference.
 */
export const KNOWN_CATALOGUE_ERRORS = new Set(["ru:Ranked Battles", "uk:Ranked Battles"]);

/** An entry's `term`, read from its frontmatter. The translator writes a
 * scalar quoted as JSON when YAML would misread it, and plain otherwise. */
export function glossaryTitle(markdown: string): string | undefined {
  const front = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1];
  const raw = front && /^term:\s*(.+)$/m.exec(front)?.[1]?.trim();
  if (!raw) return undefined;
  if (raw.startsWith('"')) return JSON.parse(raw) as string;
  return raw;
}

/** Every entry of one language, as its path below the language folder. */
export function glossaryEntries(locale: string): Map<string, string> {
  const root = join(GLOSSARY_DIR, locale);
  const out = new Map<string, string>();
  if (!existsSync(root)) return out;
  for (const category of readdirSync(root, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    for (const file of readdirSync(join(root, category.name))) {
      if (!file.endsWith(".md")) continue;
      out.set(`${category.name}/${file}`, join(root, category.name, file));
    }
  }
  return out;
}

/**
 * English title to translated title, for one language.
 *
 * Empty for a language the glossary is not trusted in. The apostrophe goes
 * through `typographic`, since the glossary was written with the keyboard's and
 * the interface is held to U+2019.
 */
export function glossaryTerms(locale: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!GLOSSARY_TERM_LOCALES.includes(locale)) return out;
  const english = glossaryEntries("en");
  for (const [entry, path] of glossaryEntries(locale)) {
    const source = english.get(entry);
    if (!source) continue;
    const from = glossaryTitle(readFileSync(source, "utf-8"));
    const to = glossaryTitle(readFileSync(path, "utf-8"));
    // An identifier is written as itself by the interface translator ("ELO"
    // stays "ELO"), whatever the entry is titled, so it decides nothing here.
    if (from && to && !isIdentifier(from)) out.set(from, typographic(to));
  }
  return out;
}
