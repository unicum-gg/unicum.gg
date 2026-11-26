/**
 * What a calendar entry is, read from the portal widget's icon token rather
 * than its category label: the label is localized (and was captured in English
 * only), while the icon is the one field Wargaming writes the same everywhere.
 */
export enum CalendarKind {
  Event = "event",
  BattlePass = "battle-pass",
  Specials = "specials",
  Update = "update",
  Other = "other",
}

const KIND_BY_ICON: Record<string, CalendarKind> = {
  "calendar-days": CalendarKind.Event,
  "battle-pass": CalendarKind.BattlePass,
  star: CalendarKind.Specials,
  "arrow-down-to-line": CalendarKind.Update,
};

export const calendarKind = (icon: string): CalendarKind =>
  KIND_BY_ICON[icon] ?? CalendarKind.Other;

/**
 * An update is published as a one-minute entry marking when it goes live, so
 * it is drawn as a moment rather than as a span.
 */
export const isCalendarMoment = (start: Date, end: Date): boolean =>
  end.getTime() - start.getTime() < 10 * 60 * 1000;

/**
 * The portal language codes that can stand for one of our locales, best first.
 * Our locale usually IS the portal's code; the exceptions are the portals that
 * publish a regional variant (NA's `pt-br` and `es-ar`, Asia's `zh-sg`).
 */
const PORTAL_ALIASES: Record<string, readonly string[]> = {
  pt: ["pt-br"],
  es: ["es", "es-ar"],
  zh: ["zh-sg", "zh-cn", "zh-tw"],
};

/** The entry's title in the reader's language, English when the portal did
 * not publish it in theirs. */
export function calendarTitle(
  titles: Record<string, string>,
  locale: string,
  fallback: string,
): string {
  for (const code of PORTAL_ALIASES[locale] ?? [locale]) {
    if (titles[code]) return titles[code];
  }
  return fallback;
}
