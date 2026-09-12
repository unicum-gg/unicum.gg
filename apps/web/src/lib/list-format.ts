/**
 * A list of names joined the way the reader's language joins them.
 *
 * `Intl.ListFormat` emits a WORD between the last two items, so pinning it to
 * English put "and" in the middle of a French sentence: "Obj. 268/4, Obj. 259A
 * and IS-3A". It is the same mistake as naming the weekdays from a table, and
 * the same fix: the language already knows.
 *
 * Cached per locale, since a tooltip formats one list per module and the
 * formatter is expensive to build.
 */
/**
 * English is asked for as `en-GB`, which is the one thing the old hardcoded
 * formatter got right: `en` adds the Oxford comma ("A, B, and C") and the site
 * does not write that. Every other language is asked for as itself.
 */
const AS_ASKED: Record<string, string> = { en: "en-GB" };

const CACHE = new Map<string, Intl.ListFormat>();

export function joinNames(items: string[], locale: string): string {
  let format = CACHE.get(locale);
  if (!format) {
    // An unknown locale throws rather than falling back, and the segment
    // reaches here straight off the route.
    try {
      format = new Intl.ListFormat(AS_ASKED[locale] ?? locale, {
        style: "long",
        type: "conjunction",
      });
    } catch {
      format = new Intl.ListFormat("en-GB", {
        style: "long",
        type: "conjunction",
      });
    }
    CACHE.set(locale, format);
  }
  return format.format(items);
}
