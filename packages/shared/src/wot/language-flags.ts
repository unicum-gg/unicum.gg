import { Region } from "@unicum.gg/wargaming";

/**
 * Why a set of language codes is being shown, which is the difference between
 * public fact and our own inference and therefore has to travel with the codes
 * rather than being re-decided per surface.
 *
 * `Clan` is the weakest of the three and is a player's last resort only: a set
 * their current clan declared, attributed to them with none of the duration
 * weighting `Inferred` does. It reads a clan's word as if it were the player's,
 * so a reader has to be told, which is the whole reason this value travels.
 */
export enum LanguageSource {
  /** The clan owner declared it. Plain public data. */
  Declared = "declared",
  /**
   * Inferred from the account's clan history, weighting each stint by how long
   * it lasted (`inferPlayerLanguages`), whether that ran on the spot or was
   * precomputed into `player_ratings`. Both are the same method.
   */
  Inferred = "inferred",
  /** No clan history at all for this account, so their current clan's declared
   * set stood in for it. A snapshot, not an inference. */
  Clan = "clan",
}

const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  en: "GB-UKM",
  fr: "FR",
  de: "DE",
  es: "ES",
  it: "IT",
  pt: "PT",
  nl: "NL",
  ru: "RU",
  pl: "PL",
  cs: "CZ",
  sk: "SK",
  hu: "HU",
  ro: "RO",
  bg: "BG",
  hr: "HR",
  bs: "BA",
  sr: "RS",
  sl: "SI",
  uk: "UA",
  be: "BY",
  lt: "LT",
  lv: "LV",
  et: "EE",
  el: "GR",
  tr: "TR",
  fi: "FI",
  sv: "SE",
  no: "NO",
  da: "DK",
  ja: "JP",
  ko: "KR",
  vi: "VN",
  th: "TH",
  zh: "CN",
  "zh-cn": "CN",
  "zh-tw": "TW",
  ar: "SA",
  he: "IL",
  // Post-Soviet and Balkan languages that show up on EU + ASIA clan rosters.
  // Several map to their country of origin (kk → Kazakhstan) rather than to
  // a script (Cyrillic) since visitors recognize national flags faster.
  // `mo` is the legacy ISO code for Moldovan, kept as a separate flag from
  // Romanian so a clan declaring both surfaces two distinct visuals.
  az: "AZ",
  hy: "AM",
  id: "ID",
  ka: "GE",
  kk: "KZ",
  ky: "KG",
  mo: "MD",
  ms: "MY",
  sq: "AL",
  tg: "TJ",
  tk: "TM",
  tl: "PH",
  uz: "UZ",
};

/**
 * Region-scoped override: a flag isn't really a language identifier, but
 * "English on NA/ASIA" overwhelmingly maps to American players (US bases,
 * expats, SEA English-speakers used to US media), so the UK flag we'd
 * otherwise show feels wrong there. EU keeps UK as the default. Other
 * languages don't get the same treatment because they're too tied to a
 * single country anyway.
 */
const REGION_OVERRIDES: Partial<Record<Region, Record<string, string>>> = {
  [Region.NA]: { en: "US" },
  [Region.ASIA]: { en: "US" },
};

/**
 * The Flagpack code a language is drawn with, or null when we ship no flag for
 * it and the caller shows the raw code instead.
 *
 * Lives here rather than beside the flag component because the public API
 * serves the resolved code (`/{region}/resolve`): the mapping is not
 * mechanical (`en` is `GB-UKM` on EU and `US` elsewhere, `mo` is deliberately
 * kept apart from `ro`, and `GB-UKM` is not an ISO country code at all), so a
 * non-web caller re-deriving it would vendor a copy and need a release of its
 * own every time one of those decisions moves.
 */
export function languageToCountryCode(
  language: string,
  region?: Region,
): string | null {
  const normalized = language.toLowerCase();
  const overrides = (region && REGION_OVERRIDES[region]) || {};
  // `hasOwn` rather than a bare index: these are plain object literals, so a
  // code that happens to name an `Object.prototype` member ("constructor")
  // would otherwise return an inherited value, typed `string` and on its way
  // into an `<img src>` and into the public API's `countries` array.
  if (Object.hasOwn(overrides, normalized)) return overrides[normalized];
  if (Object.hasOwn(LANGUAGE_TO_COUNTRY, normalized)) {
    return LANGUAGE_TO_COUNTRY[normalized];
  }
  return null;
}

/**
 * The same mapping over a list, aligned index for index with its input: a
 * language we ship no flag for holds a null rather than being dropped, so the
 * two arrays can always be paired and the caller falls back to the code itself
 * exactly where the site does.
 */
export function languagesToCountryCodes(
  languages: string[],
  region?: Region,
): (string | null)[] {
  return languages.map((language) => languageToCountryCode(language, region));
}
