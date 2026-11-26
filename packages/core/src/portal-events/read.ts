import { portalEventsByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { asc, isNull, min } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";

export type PortalCalendarEntry = {
  /** Stable across reads: the article path and the start. */
  id: string;
  title: string;
  titles: Record<string, string>;
  category: string;
  color: string;
  icon: string;
  start: Date;
  end: Date;
  link: string;
  banner: string | null;
  thumbnail: string | null;
  discordEventId: string | null;
};

export type PortalCalendar = {
  region: Region;
  /** When this region's widget was first recorded: nothing before it can be
   * known, which the page says rather than showing an empty past. */
  recordedSince: Date | null;
  entries: PortalCalendarEntry[];
};

/**
 * Every entry the region's widget has shown, oldest first. Whole rather than
 * windowed: the widget publishes a handful of entries a week, so the table
 * holds a few hundred rows a year and a month view or a list both read it all.
 */
export async function readPortalCalendar(region: Region): Promise<PortalCalendar> {
  const table = portalEventsByRegion[region];
  const [rows, [since]] = await Promise.all([
    db.select().from(table).where(isNull(table.supersededAt)).orderBy(asc(table.startAt)),
    db.select({ at: min(table.firstSeenAt) }).from(table),
  ]);
  return {
    region,
    recordedSince: since?.at ?? null,
    entries: rows.map((row) => ({
      id: `${row.path}@${row.startAt.getTime()}`,
      title: row.title,
      titles: row.titles,
      category: row.category,
      color: row.color,
      icon: row.icon,
      start: row.startAt,
      end: row.endAt,
      link: row.link,
      // `''` records an article without one, which is no banner to a reader.
      banner: row.banner || null,
      thumbnail: row.thumbnail,
      discordEventId: row.discordEventId,
    })),
  };
}
