import { format } from "date-fns";
import { dateLocale } from "./date-locale";
/**
 * Numbers, dates and lists in the reader's own language.
 *
 * `Intl` was called with a hardcoded "en-US" in 175 places, which is invisible
 * in English and reads as half a translation everywhere else: a French page
 * showed "1,912,999" where a French reader writes "1 912 999", and a chart axis
 * ran "Aug 11 … Sep 8" under a heading that said "Tendances, derniers 30 jours".
 *
 * The formatters are memoized per (locale, options) because building one is
 * expensive and an axis rebuilds its ticks on every render.
 */
const CACHE = new Map<string, Intl.NumberFormat>();

/**
 * The locale to hand `Intl`.
 *
 * Our own codes are language-only and `Intl` wants a BCP-47 tag, which it
 * mostly is already. `en` is the exception worth naming: the site's own English
 * is written in British spelling, but its numbers and dates read better in the
 * form the majority of its English readers use, which is what "en-US" was
 * chosen for in the first place.
 */
const INTL_LOCALE: Record<string, string> = { en: "en-US" };

const tagFor = (locale: string) => INTL_LOCALE[locale] ?? locale;

function cached<T extends Intl.NumberFormat>(
  kind: "n",
  locale: string,
  options: Intl.NumberFormatOptions,
  make: () => T,
): T {
  const key = `${kind}:${locale}:${JSON.stringify(options)}`;
  let held = CACHE.get(key);
  if (!held) {
    held = make();
    CACHE.set(key, held);
  }
  return held as T;
}

/**
 * A bound number formatter, as `useFormat().num` hands it over.
 *
 * Named because the data tables take it as an argument: a column definition is
 * data, not a component, so it cannot read a hook and the reader's formatting
 * has to arrive from whoever renders it.
 */
export type NumberFormatter = (
  options?: Intl.NumberFormatOptions,
) => Intl.NumberFormat;

export function numberFormat(
  locale: string,
  options: Intl.NumberFormatOptions = {},
): Intl.NumberFormat {
  return cached("n", locale, options, () =>
    new Intl.NumberFormat(tagFor(locale), options),
  );
}

/**
 * A date formatter for a pattern, in the reader's language.
 *
 * `date-fns` rather than `Intl`, which is this project's convention and the
 * better one here: the pattern is written once ("d MMM yyyy") and the library
 * carries the month names, so a heading and a table cell cannot disagree the
 * way two `Intl` option objects can. `Intl` stays for numbers, which `date-fns`
 * does not do.
 *
 * A pattern ending in a UTC marker is formatted as UTC: the project has no
 * `date-fns-tz`, so the instant is shifted by the runtime's own offset and then
 * printed locally, which prints the UTC reading. Marked in the pattern rather
 * than passed apart, so a constant carries its own timezone wherever it goes.
 */
const UTC_MARK = " /* UTC */";

export type DateFormatter = {
  format: (at: Date | string | number) => string;
  formatRange: (from: Date | string | number, to: Date | string | number) => string;
};

export function dateFormat(locale: string, pattern: string): DateFormatter {
  const utc = pattern.endsWith(UTC_MARK);
  const shape = utc ? pattern.slice(0, -UTC_MARK.length) : pattern;
  const opts = { locale: dateLocale(locale) };
  const at = (value: Date | string | number) => {
    const d = value instanceof Date ? value : new Date(value);
    return utc ? new Date(d.getTime() + d.getTimezoneOffset() * 60_000) : d;
  };
  return {
    format: (value) => format(at(value), shape, opts),
    formatRange: (from, to) =>
      `${format(at(from), shape, opts)} – ${format(at(to), shape, opts)}`,
  };
}

/**
 * Which ordinal form a number takes in a language, as CLDR names them.
 *
 * `Intl` formats no ordinal anywhere, so the suffix itself has to be written
 * per language, but WHICH of them a number takes is a rule the platform does
 * carry, and it is not "1, 2, 3 then the rest": English brackets 1/21/31 apart
 * from 2/22 and from 3/23, Italian marks 8, 11, 80 and 100, Ukrainian 3 and 4,
 * and most languages have a single form. Selected here rather than written into
 * a table per locale, which is the half that would go stale.
 *
 * Cardinal rules are the wrong ones and are what `{n, plural, …}` would select:
 * English reads 2 as "other" there, which is how a plural block renders "2th".
 */
const ORDINAL_RULES = new Map<string, Intl.PluralRules>();

export function ordinalForm(locale: string, n: number): Intl.LDMLPluralRule {
  const tag = tagFor(locale);
  let rules = ORDINAL_RULES.get(tag);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(tag, { type: "ordinal" });
    } catch {
      rules = new Intl.PluralRules("en-US", { type: "ordinal" });
    }
    ORDINAL_RULES.set(tag, rules);
  }
  return rules.select(n);
}
