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
import {
  CHROME_NAMESPACES,
  ROUTE_NAMESPACES,
  type RouteScope,
} from "@/locales/generated/scopes";
import { composeStatLabels } from "@/lib/stat-labels";
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
 * What crosses the wire, and why it is two calls rather than one.
 *
 * The client provider is handed ONE dictionary set and the library's loader is
 * synchronous, so whatever a reader might ask for has to be there already:
 * there is no asking for a namespace later. That used to mean the whole
 * catalogue on every page, 399 namespaces and 263 342 octets of French, which
 * measured 59% of a player profile's payload while the page's own prose is a
 * few kilobytes.
 *
 * So the catalogue is cut where it is read. `CHROME_NAMESPACES` is what every
 * page shares (the navigation, the footer, the search, the badges, and the
 * boundaries that render where a page did not), handed to the root provider;
 * `ROUTE_NAMESPACES` is what each route adds, handed to a `DictionaryScope`
 * that layers over it. Both are derived from the import graph by
 * `scripts/generate-locale-scopes`, so the catalogue follows the code with
 * nobody keeping a list. Measured on French: 33 014 octets of chrome and 41 527
 * on average per page, against 263 342 before, and twice the saving per ISR
 * entry since the payload is stored as well as inlined.
 *
 * Both are resolved once per locale per process, and the route sets once per
 * locale and route: the root layout renders on every page and a section's page
 * renders on every entity in it, so filtering the same hundreds of entries each
 * time is work with one possible answer.
 */
const CACHE = new Map<string, Promise<Dictionaries>>();

function cut(
  locale: Locale,
  key: string,
  namespaces: readonly string[],
): Promise<Dictionaries> {
  const cacheKey = `${locale}:${key}`;
  let pending = CACHE.get(cacheKey);
  if (!pending) {
    const wanted = new Set<string>(namespaces);
    pending = getDictionaries(locale).then((all) => {
      const out: Dictionaries = {};
      for (const [namespace, dictionary] of Object.entries(all)) {
        if (wanted.has(namespace)) out[namespace as Namespace] = dictionary;
      }
      return out;
    });
    CACHE.set(cacheKey, pending);
  }
  return pending;
}

/** What every page carries, for the root provider. */
export function getChromeDictionaries(locale: Locale): Promise<Dictionaries> {
  return cut(locale, "", CHROME_NAMESPACES);
}

/** What one route adds to the chrome, for its own `Dictionaries`. */
export function getRouteDictionaries(
  locale: string,
  scope: RouteScope,
): Promise<Dictionaries> {
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return cut(resolved, scope, ROUTE_NAMESPACES[scope]);
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

/**
 * The server half of the stat-label translator, paired with `useStatLabels`.
 *
 * Same composition, same reason: a heading that is one of the game's own names
 * comes off `game/vocabulary` rather than being translated a second time under
 * a prose prompt. See `composeStatLabels`.
 */
export async function getStatLabels(locale: string): Promise<Translation> {
  const [stats, game] = await Promise.all([
    getTranslation("components/stat-labels", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  return { t: composeStatLabels(stats.t, game.t), locale: stats.locale };
}
