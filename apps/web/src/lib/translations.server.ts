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
import { CLIENT_NAMESPACES } from "@/locales/generated/client-namespaces";
import { composeStatLabels } from "@/lib/stat-labels";
import {
  DEFAULT_LOCALE,
  isLocale,
  Locale,
  SERVER_ONLY_NAMESPACES,
} from "./translations";

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
 * Everything the browser needs, and nothing it does not.
 *
 * The client provider is handed ONE dictionary set and its loader is
 * synchronous, so whatever a reader might ask for has to be there already:
 * there is no asking for a namespace later. That used to mean the whole
 * catalogue, 399 namespaces and 263 342 octets of French inlined in the RSC
 * payload of EVERY page, which measured 59% of a player profile's payload while
 * the page's own prose is a few kilobytes. Most of it was copy only the server
 * renders.
 *
 * Two filters, and they answer different questions. `CLIENT_NAMESPACES` is
 * derived from the import graph and says what the browser bundle CAN read, so
 * it follows the code with nobody maintaining a list. `SERVER_ONLY_NAMESPACES`
 * says what must never cross whatever the code does, which is still needed:
 * those seven are heavy, they are named in the deny list itself, and that
 * declaration lives in a module client components import, so the derivation
 * sees their names and would ship all seven. It over-includes by design, in the
 * direction where the cost is bytes rather than a raw key at a reader.
 *
 * Resolved once per locale per process, like the full set it is cut from: the
 * root layout renders on every page, and filtering 399 entries each time is
 * work with one possible answer.
 */
const forClient = new Map<Locale, Promise<Dictionaries>>();

const shipped = new Set<string>(
  CLIENT_NAMESPACES.filter(
    (namespace) => !SERVER_ONLY_NAMESPACES.includes(namespace),
  ),
);

async function buildClientDictionaries(locale: Locale): Promise<Dictionaries> {
  const all = await getDictionaries(locale);
  const out: Dictionaries = {};
  for (const [namespace, dictionary] of Object.entries(all)) {
    if (shipped.has(namespace)) out[namespace as Namespace] = dictionary;
  }
  return out;
}

export function getClientDictionaries(locale: Locale): Promise<Dictionaries> {
  let pending = forClient.get(locale);
  if (!pending) {
    pending = buildClientDictionaries(locale);
    forClient.set(locale, pending);
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
