import { Region } from "@unicum.gg/wargaming";

/** The language every entry is keyed and announced in. */
export const PORTAL_EVENTS_LANGUAGE = "en";

/**
 * The languages each portal publishes its events widget in, by the portal's own
 * code, measured 2026-11-26 by asking every portal for each of our locales.
 * The others either redirect to English or serve a page without the widget
 * (Asia's `vi` and `th`). Asia's `ja` and `ko` answer with the widget and an
 * empty week; they are read anyway, since they cost one request an hour and
 * would start filling the day Wargaming writes them.
 */
export const PORTAL_EVENTS_LANGUAGES: Record<Region, readonly string[]> = {
  [Region.EU]: ["en", "fr", "de", "pl", "cs", "es", "it", "hu", "tr", "uk", "ru"],
  [Region.NA]: ["en", "es-ar", "pt-br"],
  [Region.ASIA]: ["en", "zh-tw", "zh-sg", "ja", "ko"],
};
