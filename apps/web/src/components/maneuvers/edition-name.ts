import type { TranslateFunction } from "@onruntime/translations";
import { parseManeuversEventName } from "@unicum.gg/shared";

/**
 * An edition's name in the reader's language, "Autumn 2026", read off its
 * identifier. The game names no edition (Wargaming only calls them "Spring
 * Maneuvers" and the like in its announcements), so the season and the year
 * are the whole of it. An identifier that does not follow the source's pattern
 * is shown as it is rather than dropped.
 *
 * `t` is `components/maneuvers/edition-name`.
 */
export function maneuversEditionName(
  eventName: string,
  t: TranslateFunction,
): string {
  const key = parseManeuversEventName(eventName);
  if (!key) return eventName;
  return t(`seasons.${key.season}`, { year: key.year });
}
