import { Region } from "@unicum.gg/wargaming/region";

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

export function languageToCountryCode(
  language: string,
  region?: Region,
): string | null {
  const normalized = language.toLowerCase();
  const override = region && REGION_OVERRIDES[region]?.[normalized];
  return override ?? LANGUAGE_TO_COUNTRY[normalized] ?? null;
}
