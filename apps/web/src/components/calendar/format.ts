import type { DisplayZone } from "@/components/servers/format";

/** The calendar's clock readings, in the reader's language and, once hydrated,
 * their own timezone (see `useDisplayZone` for why UTC first). */

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(
  locale: string,
  zone: DisplayZone,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${zone}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: zone === "UTC" ? "UTC" : undefined,
    });
    cache.set(key, f);
  }
  return f;
}

/** "Mon, 23 Nov, 10:00". */
export const formatWhen = (at: Date, zone: DisplayZone, locale: string) =>
  formatter(locale, zone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);

/** "November 2026", a month heading. */
export const formatMonth = (at: Date, zone: DisplayZone, locale: string) =>
  formatter(locale, zone, { month: "long", year: "numeric" }).format(at);

/** "Mon", a weekday column heading, in the zone the grid was built in. */
export const formatWeekday = (at: Date, zone: DisplayZone, locale: string) =>
  formatter(locale, zone, { weekday: "short" }).format(at);

/** "in 4 days", "3 hours ago": the largest unit that reads as a whole number. */
export function formatRelative(ms: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(ms);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, size] of units) {
    if (abs >= size || unit === "minute") return rtf.format(Math.round(ms / size), unit);
  }
  return rtf.format(0, "minute");
}

/** The calendar day an instant falls on, in the zone it is drawn in, as a
 * `YYYY-MM-DD` key the month grid can compare. */
export function dayKey(at: Date, zone: DisplayZone): string {
  const d = zone === "UTC" ? at : new Date(at.getTime() - at.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 10);
}
