import {
  createGetPreferredLocale,
  type LocaleRequest,
} from "@onruntime/translations";

/**
 * Where a reader's language choice is remembered. Declared here rather than in
 * `constants/storage` (which re-exports it, like the auth region cookie) so this
 * module imports nothing from the app: the locale generator and the proxy both
 * read it outside the bundler's path aliases.
 */
export const LOCALE_COOKIE = "unicum.locale";

/**
 * The interface languages the site is published in.
 *
 * The list is not a guess: `en` plus every language declared by at least 10,000
 * rated players across the three servers, as counted from the clan language
 * metadata we already store (`*_clan_ratings.languages`), plus the handful the
 * studio's other sites carry. That threshold is what separates a language with
 * a World of Tanks community behind it (`uk`, `cs`, `sk`, `hu`, `ro`, `sr`,
 * `hr`, `be`, `bs`, `vi`, `th`) from the long tail of a few hundred accounts.
 *
 * Adding one is a member here plus a CI run: the English files are the only
 * ones written by hand, everything else is generated from them.
 */
export enum Locale {
  EN = "en",
  FR = "fr",
  DE = "de",
  ES = "es",
  IT = "it",
  PT = "pt",
  NL = "nl",
  PL = "pl",
  SV = "sv",
  CS = "cs",
  SK = "sk",
  HU = "hu",
  RO = "ro",
  UK = "uk",
  RU = "ru",
  BE = "be",
  SR = "sr",
  HR = "hr",
  BS = "bs",
  TR = "tr",
  JA = "ja",
  KO = "ko",
  ZH = "zh",
  VI = "vi",
  TH = "th",
  AR = "ar",
  HI = "hi",
  BG = "bg",
  EL = "el",
  FI = "fi",
  LT = "lt",
  LV = "lv",
  DA = "da",
  NO = "no",
  KK = "kk",
  TL = "tl",
}

/** Every locale, in the order the language menu lists them. */
export const LOCALES: readonly Locale[] = Object.values(Locale);

/** The locale served without a path prefix. */
export const DEFAULT_LOCALE = Locale.EN;

/**
 * Each language named in itself. A reader looking for their own language scans
 * for the word they would write, not for its English name.
 */
export const LOCALE_LABEL: Record<Locale, string> = {
  [Locale.EN]: "English",
  [Locale.FR]: "Français",
  [Locale.DE]: "Deutsch",
  [Locale.ES]: "Español",
  [Locale.IT]: "Italiano",
  [Locale.PT]: "Português",
  [Locale.NL]: "Nederlands",
  [Locale.PL]: "Polski",
  [Locale.SV]: "Svenska",
  [Locale.CS]: "Čeština",
  [Locale.SK]: "Slovenčina",
  [Locale.HU]: "Magyar",
  [Locale.RO]: "Română",
  [Locale.UK]: "Українська",
  [Locale.RU]: "Русский",
  [Locale.BE]: "Беларуская",
  [Locale.SR]: "Српски",
  [Locale.HR]: "Hrvatski",
  [Locale.BS]: "Bosanski",
  [Locale.TR]: "Türkçe",
  [Locale.JA]: "日本語",
  [Locale.KO]: "한국어",
  [Locale.ZH]: "中文",
  [Locale.VI]: "Tiếng Việt",
  [Locale.TH]: "ไทย",
  [Locale.AR]: "العربية",
  [Locale.HI]: "हिन्दी",
  [Locale.BG]: "Български",
  [Locale.EL]: "Ελληνικά",
  [Locale.FI]: "Suomi",
  [Locale.LT]: "Lietuvių",
  [Locale.LV]: "Latviešu",
  [Locale.DA]: "Dansk",
  [Locale.NO]: "Norsk",
  [Locale.KK]: "Қазақша",
  [Locale.TL]: "Tagalog",
};

/**
 * `og:locale` wants a language and a territory, and the pair is not derivable
 * from the code (`cs` belongs to `CZ`, `en` to `US`, `hi` to `IN`), so the
 * territory is named here rather than guessed by upper-casing the language.
 */
export const OG_LOCALE: Record<Locale, string> = {
  [Locale.EN]: "en_US",
  [Locale.FR]: "fr_FR",
  [Locale.DE]: "de_DE",
  [Locale.ES]: "es_ES",
  [Locale.IT]: "it_IT",
  [Locale.PT]: "pt_PT",
  [Locale.NL]: "nl_NL",
  [Locale.PL]: "pl_PL",
  [Locale.SV]: "sv_SE",
  [Locale.CS]: "cs_CZ",
  [Locale.SK]: "sk_SK",
  [Locale.HU]: "hu_HU",
  [Locale.RO]: "ro_RO",
  [Locale.UK]: "uk_UA",
  [Locale.RU]: "ru_RU",
  [Locale.BE]: "be_BY",
  [Locale.SR]: "sr_RS",
  [Locale.HR]: "hr_HR",
  [Locale.BS]: "bs_BA",
  [Locale.TR]: "tr_TR",
  [Locale.JA]: "ja_JP",
  [Locale.KO]: "ko_KR",
  [Locale.ZH]: "zh_CN",
  [Locale.VI]: "vi_VN",
  [Locale.TH]: "th_TH",
  [Locale.AR]: "ar_AR",
  [Locale.HI]: "hi_IN",
  [Locale.BG]: "bg_BG",
  [Locale.EL]: "el_GR",
  [Locale.FI]: "fi_FI",
  [Locale.LT]: "lt_LT",
  [Locale.LV]: "lv_LV",
  [Locale.DA]: "da_DK",
  // Bokmål, the written standard nearly all Norwegian is published in, and the
  // only Norwegian `og:locale` a crawler resolves.
  [Locale.NO]: "nb_NO",
  [Locale.KK]: "kk_KZ",
  [Locale.TL]: "tl_PH",
};

/** Locales written right to left, which the document element has to declare. */
const RTL_LOCALES: readonly Locale[] = [Locale.AR];

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/**
 * The locale a path names, and what is left of the path once it is removed.
 * The default locale is served prefix-less, so a path carrying no prefix is
 * already in it.
 */
export function splitLocale(pathname: string): {
  locale: Locale;
  rest: string;
  prefixed: boolean;
} {
  const [, first = "", ...others] = pathname.split("/");
  if (!isLocale(first)) return { locale: DEFAULT_LOCALE, rest: pathname, prefixed: false };
  return { locale: first, rest: `/${others.join("/")}`, prefixed: true };
}

/**
 * A path as it is served in `locale`: prefixed, except in the default one.
 *
 * Takes the raw route segment rather than a validated `Locale`, so a page hands
 * over what Next gave it without a check of its own. The proxy only ever routes
 * a known language here, and anything else reads as the default, which is the
 * page that would have been served anyway.
 */
export function localizePath(pathname: string, locale: string): string {
  const { rest } = splitLocale(pathname);
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) return rest;
  return rest === "/" ? `/${locale}` : `/${locale}${rest}`;
}

/**
 * The locale to serve a visitor who asked for no particular one: their own
 * previous choice first, then what their browser advertises.
 */
export const getPreferredLocale = createGetPreferredLocale({
  locales: LOCALES as string[],
  defaultLocale: DEFAULT_LOCALE,
  localeCookie: LOCALE_COOKIE,
}) as (request: LocaleRequest) => Locale;

/**
 * Namespaces the browser never receives.
 *
 * Every namespace is handed to the client provider as one dictionary set, so a
 * namespace costs its own weight on EVERY page rather than on the pages that
 * read it. Three of them are large and read in exactly one place each:
 * `game/map-descriptions` is 20 KB of map blurbs that only a map's own page
 * shows, and `game/equipment` and `game/crew-perks` are 21 KB naming a tank's
 * loadout, which only a tank page reads. Together they were 40% of the payload
 * on pages that never touch them.
 *
 * So those three are resolved on the server, where `getTranslation` still sees
 * them, and stripped before the dictionaries cross the wire. A client component
 * that reads one gets its key back, which is why `tests/validation/locales`
 * fails if a `"use client"` file names one.
 */
export const SERVER_ONLY_NAMESPACES: readonly string[] = [
  "game/map-descriptions",
  "game/equipment",
  "game/equipment-descriptions",
  "game/crew-perks",
  "game/crew-perk-descriptions",
  "game/skill-tree",
  "game/skill-tree-descriptions",
];

/** Whether the browser is meant to hold this namespace. */
export const isClientNamespace = (namespace: string): boolean =>
  !SERVER_ONLY_NAMESPACES.includes(namespace);
