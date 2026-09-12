import "server-only";
import {
  getTranslation as getTranslationCore,
  type TranslateFunction,
  type TranslationDictionary,
} from "@onruntime/translations";
import {
  loadDictionaries,
  type Dictionaries,
  type Namespace,
} from "@/locales/generated";
import { DEFAULT_LOCALE, isLocale, Locale } from "./translations";

/**
 * The locale is always passed in, never read from `headers()`.
 *
 * Reading a header opts a page out of static rendering, and most of this site is
 * `force-static` behind the ISR cache. The locale is a route segment, so every
 * page and layout already has it in `params`: threading it is free, and it is
 * the same reasoning that makes `constructMetadata` take an explicit `canonical`
 * instead of deriving one from the request.
 */
export type Translation = { t: TranslateFunction; locale: Locale };

/**
 * One locale's dictionaries with English merged underneath, key by key.
 *
 * The merge is what makes a raw key impossible to render: a locale that CI has
 * not caught up with yet reads English for the keys it lacks rather than showing
 * `layout.footer.tagline` to a player. It also means the client provider gets
 * ONE dictionary set to work from instead of the locale's plus English as a
 * fallback, which would put every string on the wire twice for every reader who
 * is not on English.
 */
const merged = new Map<Locale, Promise<Dictionaries>>();

function mergeDictionary(
  base: TranslationDictionary,
  override: TranslationDictionary | undefined,
): TranslationDictionary {
  if (!override) return base;
  const out: TranslationDictionary = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] =
      typeof value === "object" && typeof existing === "object"
        ? mergeDictionary(existing, value)
        : value;
  }
  return out;
}

async function buildDictionaries(locale: Locale): Promise<Dictionaries> {
  const source = await loadDictionaries(locale);
  if (locale === DEFAULT_LOCALE) return source;

  const fallback = await loadDictionaries(DEFAULT_LOCALE);
  const out: Dictionaries = {};
  for (const [namespace, dictionary] of Object.entries(fallback)) {
    out[namespace as Namespace] = mergeDictionary(
      dictionary,
      source[namespace as Namespace],
    );
  }
  return out;
}

/**
 * Everything one locale carries, resolved once per locale per process. Handed
 * to the client provider by the root layout and read by `getTranslation`.
 */
export function getDictionaries(locale: Locale): Promise<Dictionaries> {
  let pending = merged.get(locale);
  if (!pending) {
    pending = buildDictionaries(locale);
    merged.set(locale, pending);
  }
  return pending;
}

/**
 * The translation function for one namespace, in a server component.
 *
 * ```tsx
 * const { t } = await getTranslation("components/footer", locale);
 * ```
 *
 * `locale` is the raw route segment, like everywhere else in this API
 * (`localizePath`, `constructMetadata`): a page hands over what Next gave it,
 * and anything the proxy could not have produced reads as the default.
 */
export async function getTranslation(
  namespace: Namespace,
  locale: string,
): Promise<Translation> {
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const dictionaries = await getDictionaries(resolved);
  const { t } = getTranslationCore(
    (_, requested) => dictionaries[requested as Namespace],
    resolved,
    { namespace, debug: process.env.NODE_ENV === "development" },
  );
  return { t, locale: resolved };
}
