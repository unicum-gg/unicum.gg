import { CalendarKind, calendarKind, isCalendarMoment } from "@unicum.gg/shared";
import type { z } from "zod";
import type { CalendarResponse } from "@/app/api/[region]/calendar/schema.api";

type Entry = z.infer<typeof CalendarResponse>["entries"][number];

/**
 * What a reader plays or watches, ahead of what they buy: a sale or a Battle
 * Pass season runs for weeks and would otherwise fill every slot.
 */
const WEIGHT: Record<CalendarKind, number> = {
  [CalendarKind.Event]: 0,
  [CalendarKind.Competitive]: 0,
  [CalendarKind.Livestream]: 1,
  [CalendarKind.Update]: 1,
  [CalendarKind.Specials]: 2,
  [CalendarKind.Other]: 2,
  [CalendarKind.BattlePass]: 3,
};

/**
 * The few entries worth a place outside the calendar (the home page): what is
 * on now, the events first and then whatever ends soonest, then what starts
 * next. A module of its own rather than a client component's export, because
 * the server calls it and would be handed a client reference instead.
 */
export function featuredCalendarEntries(entries: Entry[], now: Date, count: number): Entry[] {
  const weight = (e: Entry) => WEIGHT[calendarKind(e.icon)];
  const live = entries
    .filter((e) => !isCalendarMoment(e.start, e.end) && e.start <= now && e.end > now)
    .sort((a, b) => weight(a) - weight(b) || a.end.getTime() - b.end.getTime());
  const next = entries
    .filter((e) => e.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || weight(a) - weight(b));
  return [...live, ...next].slice(0, count);
}
