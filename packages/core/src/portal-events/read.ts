import {
  portalEventsByRegion,
  portalMonthlyEventsByRegion,
  type PortalMonthlyEventRow,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { asc, isNull, min } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";

export enum PortalCalendarSource {
  /** The home page widget, dated to the minute. */
  Widget = "widget",
  /** The "WoT Monthly" article, dated by the day. */
  Monthly = "monthly",
}

export type PortalCalendarEntry = {
  /** Stable across reads. */
  id: string;
  source: PortalCalendarSource;
  title: string;
  titles: Record<string, string>;
  /** The entry's text by portal language code, empty when it has none. */
  descriptions: Record<string, string>;
  category: string;
  color: string;
  icon: string;
  start: Date;
  /** Exclusive. An all-day entry ends at midnight UTC after its last day. */
  end: Date;
  /** Dated by the day (the monthly article), so drawn without a clock time. */
  allDay: boolean;
  link: string | null;
  banner: string | null;
  thumbnail: string | null;
  discordEventId: string | null;
};

export type PortalCalendar = {
  region: Region;
  /** The earliest date anything was recorded for: nothing before it can be
   * known, which the page says rather than showing an empty past. */
  recordedSince: Date | null;
  entries: PortalCalendarEntry[];
};

const DAY_MS = 86_400_000;
const utcDay = (date: string) => new Date(`${date}T00:00:00Z`);

/** A portal path's language segment: `/en/`, `/pt-br/`, `/zh-tw/`. */
const LANGUAGE_SEGMENT = /^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/;

/** The article path a monthly entry leads to, without its language segment
 * (monthly links are written with and without one), to match the widget's. */
function monthlyPath(row: PortalMonthlyEventRow): string | null {
  if (!row.link) return null;
  try {
    return new URL(row.link).pathname.replace(LANGUAGE_SEGMENT, "");
  } catch {
    return null;
  }
}

/**
 * An entry the editors dated so far before its own month that it can only be
 * a typo ("Random Events" in November 2025, dated 24 November 2022). Kept in
 * the table as published, left off the calendar.
 */
const MAX_DAYS_BEFORE_PERIOD = 180;

/**
 * One row per entry. An entry spanning several months (a Battle Pass season, a
 * token store, an Onslaught season) is listed again in every month's article,
 * so the same start and title arrive once per month, sometimes with the end
 * corrected in between; the latest article's copy is kept, being the one the
 * editors touched last.
 */
function distinctMonthly(rows: PortalMonthlyEventRow[]): PortalMonthlyEventRow[] {
  const byEntry = new Map<string, PortalMonthlyEventRow>();
  for (const row of rows) {
    const periodStart = utcDay(`${row.period}-01`).getTime();
    if (utcDay(row.endDate).getTime() < periodStart - MAX_DAYS_BEFORE_PERIOD * DAY_MS) continue;
    const key = `${row.startDate}|${row.title}`;
    const held = byEntry.get(key);
    if (!held || held.period < row.period) byEntry.set(key, row);
  }
  return [...byEntry.values()];
}

/**
 * Every entry the region's calendar has held, both sources, oldest first.
 * Whole rather than windowed: both publish a handful of entries a week.
 *
 * An entry both sources carry (same article, overlapping dates) is drawn once:
 * the widget's, which knows the time of day, with the monthly article's text.
 */
export async function readPortalCalendar(region: Region): Promise<PortalCalendar> {
  const widget = portalEventsByRegion[region];
  const monthly = portalMonthlyEventsByRegion[region];
  const [rows, monthlyRows, [since]] = await Promise.all([
    db.select().from(widget).where(isNull(widget.supersededAt)).orderBy(asc(widget.startAt)),
    db
      .select()
      .from(monthly)
      .where(isNull(monthly.removedAt))
      .orderBy(asc(monthly.startDate), asc(monthly.position)),
    db.select({ at: min(widget.firstSeenAt) }).from(widget),
  ]);

  const entries: PortalCalendarEntry[] = rows.map((row) => ({
    id: `${row.path}@${row.startAt.getTime()}`,
    source: PortalCalendarSource.Widget,
    title: row.title,
    titles: row.titles,
    descriptions: {},
    category: row.category,
    color: row.color,
    icon: row.icon,
    start: row.startAt,
    end: row.endAt,
    allDay: false,
    link: row.link,
    // `''` records an article without one, which is no banner to a reader.
    banner: row.banner || null,
    thumbnail: row.thumbnail,
    discordEventId: row.discordEventId,
  }));

  for (const row of distinctMonthly(monthlyRows)) {
    const start = utcDay(row.startDate);
    const end = new Date(utcDay(row.endDate).getTime() + DAY_MS);
    const path = monthlyPath(row);
    const twin = path
      ? entries.find(
          (e) =>
            e.source === PortalCalendarSource.Widget &&
            e.id.startsWith(`${path}@`) &&
            e.start < end &&
            e.end > start,
        )
      : undefined;
    if (twin) {
      twin.descriptions = { ...row.descriptions, ...twin.descriptions };
      twin.banner ??= row.image;
      continue;
    }
    entries.push({
      id: `monthly:${row.period}:${row.startDate}:${row.title}`,
      source: PortalCalendarSource.Monthly,
      title: row.title,
      titles: row.titles,
      descriptions: row.descriptions,
      category: row.category,
      color: row.color,
      icon: row.icon,
      start,
      end,
      allDay: true,
      link: row.link,
      banner: row.image,
      thumbnail: null,
      discordEventId: null,
    });
  }
  entries.sort((a, b) => a.start.getTime() - b.start.getTime());

  const firstMonthlyRow = monthlyRows.length
    ? monthlyRows.reduce((a, b) => (a.period < b.period ? a : b))
    : null;
  // The first article's month, not its earliest date: entries carried over
  // from before reach back further than anything that was published then.
  const firstMonthly = firstMonthlyRow ? utcDay(`${firstMonthlyRow.period}-01`) : null;
  const firstWidget = since?.at ?? null;
  const recordedSince =
    firstMonthly && firstWidget
      ? firstMonthly < firstWidget
        ? firstMonthly
        : firstWidget
      : (firstMonthly ?? firstWidget);
  return { region, recordedSince, entries };
}
