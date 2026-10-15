/**
 * A language's name, in the reader's own language.
 *
 * `Intl.DisplayNames` knows every code the browser and Node ship data for, so
 * this is a lookup rather than a table of ours: `fr` reads "French" to an
 * English reader and "français" to a French one. It was hardcoded to `en` in
 * seven copies, which is why a French clan page announced clans that declared
 * "French" rather than "français".
 *
 * Cached per display locale: the formatter is expensive to build and the pages
 * that use it render one language name per row.
 */
const CACHE = new Map<string, Intl.DisplayNames>();

/**
 * Codes clans declare that CLDR folds into another language's name.
 *
 * `mo` is the withdrawn ISO code for Moldovan, which CLDR canonicalises to
 * Romanian, so a menu listing both `ro` and `mo` (they carry different flags)
 * read "Romanian" twice. Asked for as `ro-MD` instead, which CLDR names as
 * Moldavian in every locale we publish ("moldave", "Moldauisch").
 */
const DISPLAY_TAG: Record<string, string> = {
  mo: "ro-MD",
};

/**
 * Capitalise a string's first letter by the reader's own rules.
 *
 * CLDR writes a language the way it reads mid-sentence, which is lowercase in
 * French, Spanish, Italian, Polish and most of the languages we publish
 * ("joueurs français"). That is right in a sentence and wrong as a label on its
 * own, a menu entry or a chip, where those same languages capitalise it.
 * `Intl.DisplayNames` has no option for the standalone form, so it is done
 * here, with the locale's casing (Turkish `i` → `İ`).
 */
export function capitalizeFirst(name: string, locale: string): string {
  const first = String.fromCodePoint(name.codePointAt(0) ?? 0);
  if (!first) return name;
  let upper: string;
  try {
    upper = first.toLocaleUpperCase(locale);
  } catch {
    upper = first.toUpperCase();
  }
  return upper + name.slice(first.length);
}

export function languageDisplayName(
  code: string,
  locale: string,
  {
    standalone = false,
  }: {
    /** A label on its own (a menu entry) rather than a word in a sentence. */
    standalone?: boolean;
  } = {},
): string {
  let names = CACHE.get(locale);
  if (!names) {
    // An unknown locale would throw rather than fall back, and the segment
    // reaches here straight off the route.
    try {
      names = new Intl.DisplayNames([locale], { type: "language" });
    } catch {
      names = new Intl.DisplayNames(["en"], { type: "language" });
    }
    CACHE.set(locale, names);
  }
  // `of` throws on a malformed tag, and these codes come from clan metadata.
  let name: string;
  try {
    name = names.of(DISPLAY_TAG[code] ?? code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
  return standalone ? capitalizeFirst(name, locale) : name;
}
