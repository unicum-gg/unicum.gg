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

export function languageDisplayName(code: string, locale: string): string {
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
  try {
    return names.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
