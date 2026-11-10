/**
 * The Maneuvers editions, past and present.
 *
 * Unlike Onslaught, whose seasons the client names one by one, the game ships no
 * catalogue of Maneuvers editions: the client's own strings say "Maneuvers" and
 * nothing else, and the source forgets an edition the moment it ends. So the
 * history is kept here, by hand, from Wargaming's own announcements, and the
 * board's edition picker lists all of it, greying out the editions nobody
 * recorded. An edition the feeder records is selectable whether or not it is
 * listed here, since its key carries everything the picker needs to name it.
 */

export enum ManeuversSeason {
  Spring = "spring",
  Summer = "summer",
  Autumn = "autumn",
}

export type ManeuversEditionKey = {
  year: number;
  season: ManeuversSeason;
};

/**
 * Every edition Wargaming has run, newest first. The 2023 one was the
 * experimental August run; from 2024 the event settled into a spring and an
 * autumn edition a year. Add the next one when it is announced, or let the
 * feeder add it by recording it.
 */
export const MANEUVERS_EDITIONS: readonly ManeuversEditionKey[] = [
  { year: 2026, season: ManeuversSeason.Autumn },
  { year: 2026, season: ManeuversSeason.Spring },
  { year: 2025, season: ManeuversSeason.Autumn },
  { year: 2025, season: ManeuversSeason.Spring },
  { year: 2024, season: ManeuversSeason.Autumn },
  { year: 2024, season: ManeuversSeason.Spring },
  { year: 2023, season: ManeuversSeason.Summer },
];

const EVENT_NAME = /^stronghold_event_(\d{4})_([a-z]+)$/;
const SEASONS = new Set<string>(Object.values(ManeuversSeason));

/** The source's own identifier for an edition, e.g. `stronghold_event_2026_autumn`. */
export function maneuversEventName({ year, season }: ManeuversEditionKey): string {
  return `stronghold_event_${year}_${season}`;
}

/** The year and season an edition's identifier names, or null for one that
 * does not follow the source's pattern. */
export function parseManeuversEventName(
  eventName: string,
): ManeuversEditionKey | null {
  const match = EVENT_NAME.exec(eventName);
  if (!match || !SEASONS.has(match[2])) return null;
  return { year: Number(match[1]), season: match[2] as ManeuversSeason };
}

const SEASON_ORDER: Record<ManeuversSeason, number> = {
  [ManeuversSeason.Spring]: 0,
  [ManeuversSeason.Summer]: 1,
  [ManeuversSeason.Autumn]: 2,
};

/**
 * The full edition list for a picker: the known history plus whatever the
 * feeder recorded that the history does not list yet, newest first, each
 * flagged with whether we hold its standings.
 */
export function maneuversEditionHistory(
  recorded: readonly string[],
): { eventName: string; available: boolean }[] {
  const held = new Set(recorded);
  const keys = new Map<string, ManeuversEditionKey | null>();
  for (const edition of MANEUVERS_EDITIONS) {
    keys.set(maneuversEventName(edition), edition);
  }
  for (const eventName of recorded) {
    if (!keys.has(eventName)) keys.set(eventName, parseManeuversEventName(eventName));
  }
  const rank = (key: ManeuversEditionKey | null) =>
    key ? key.year * 10 + SEASON_ORDER[key.season] : -1;
  return [...keys.entries()]
    .sort(([, a], [, b]) => rank(b) - rank(a))
    .map(([eventName]) => ({ eventName, available: held.has(eventName) }));
}
