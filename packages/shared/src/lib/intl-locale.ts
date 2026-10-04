/**
 * The locale to hand `Intl`.
 *
 * Our own codes are language-only and `Intl` wants a BCP-47 tag, which it
 * mostly is already. `en` is the exception worth naming: the site's own English
 * is written in British spelling, but its numbers and dates read better in the
 * form the majority of its English readers use, which is what "en-US" was
 * chosen for in the first place.
 *
 * It lives in shared rather than beside the web app's formatters because the
 * money formatters are here, in a package the app cannot be imported from. Two
 * copies of this map is how one of them ends up a tag behind the other.
 */
const INTL_LOCALE: Record<string, string> = { en: "en-US" };

/** The BCP-47 tag for one of our locale codes. */
export function intlTag(locale: string): string {
  return INTL_LOCALE[locale] ?? locale;
}
