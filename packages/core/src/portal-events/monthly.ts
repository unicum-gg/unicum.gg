import { portalMonthlyEventsByRegion } from "@unicum.gg/shared";
import type { PortalMonthlyEvent, Region } from "@unicum.gg/wargaming";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { wg } from "@unicum.gg/core/wargaming/client";
import { PORTAL_EVENTS_LANGUAGE, PORTAL_EVENTS_LANGUAGES } from "./languages";

/** The first month published with the calendar widget. */
export const FIRST_MONTHLY_PERIOD = { year: 2025, month: 3 } as const;

/**
 * A published date made valid. The editors write these by hand, and Asia's
 * September 2025 article ended an entry on "2025-09-31": a day past the end of
 * its month is read as the month's last day, which is what was meant, and
 * anything else unreadable drops the entry rather than the whole month.
 */
function validDate(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${m[1]}-${m[2]}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

const period = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

/**
 * The other languages' titles and texts, matched to the English entries by
 * position. The articles are translations of one page, so the order is the
 * same in every language (checked on November 2026, entry by entry); the dates
 * are compared too, so an article edited in one language and not yet in
 * another is left out rather than mismatched.
 */
async function readMonthlyTranslations(
  region: Region,
  year: number,
  month: number,
  english: PortalMonthlyEvent[],
): Promise<{ titles: Record<string, string>; descriptions: Record<string, string> }[]> {
  const out = english.map(() => ({
    titles: {} as Record<string, string>,
    descriptions: {} as Record<string, string>,
  }));
  const languages = PORTAL_EVENTS_LANGUAGES[region].filter(
    (language) => language !== PORTAL_EVENTS_LANGUAGE,
  );
  await Promise.all(
    languages.map(async (language) => {
      let entries: PortalMonthlyEvent[] | null;
      try {
        entries = await wg.region(region).portal.events.monthly({ year, month, language });
      } catch (err) {
        console.warn(`[portal-monthly] ${region}/${language} ${period(year, month)}:`, err);
        return;
      }
      for (const entry of entries ?? []) {
        const en = english[entry.position];
        if (!en || en.startDate !== entry.startDate || en.endDate !== entry.endDate) continue;
        out[entry.position]!.titles[language] = entry.title;
        if (entry.description) out[entry.position]!.descriptions[language] = entry.description;
      }
    }),
  );
  return out;
}

/**
 * Record one region's calendar for one month. Returns how many entries the
 * article held, or null when the month has no article.
 */
export async function captureMonthlyEvents(
  region: Region,
  year: number,
  month: number,
): Promise<number | null> {
  const table = portalMonthlyEventsByRegion[region];
  const seenAt = new Date();
  const english = await wg
    .region(region)
    .portal.events.monthly({ year, month, language: PORTAL_EVENTS_LANGUAGE });
  if (english === null) return null;
  if (english.length === 0) return 0;
  const translations = await readMonthlyTranslations(region, year, month, english);
  const key = period(year, month);

  // One article can list the same title twice on one day only by mistake, and
  // the key would refuse the second; the first is the one kept.
  const seen = new Set<string>();
  const rows = english.flatMap((entry, i) => {
    const startDate = validDate(entry.startDate);
    const endDate = validDate(entry.endDate);
    if (!startDate || !endDate) return [];
    const id = `${startDate}|${entry.title}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [
      {
        period: key,
        startDate,
        endDate,
        title: entry.title,
        titles: { ...translations[i]!.titles, [PORTAL_EVENTS_LANGUAGE]: entry.title },
        descriptions: entry.description
          ? { ...translations[i]!.descriptions, [PORTAL_EVENTS_LANGUAGE]: entry.description }
          : translations[i]!.descriptions,
        position: entry.position,
        category: entry.category,
        color: entry.color,
        icon: entry.icon,
        image: entry.image,
        link: entry.link,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      },
    ];
  });

  await db
    .insert(table)
    .values(rows)
    .onConflictDoUpdate({
      target: [table.period, table.startDate, table.title],
      set: {
        endDate: sql`excluded.end_date`,
        titles: sql`${table.titles} || excluded.titles`,
        descriptions: sql`${table.descriptions} || excluded.descriptions`,
        position: sql`excluded.position`,
        category: sql`excluded.category`,
        color: sql`excluded.color`,
        icon: sql`excluded.icon`,
        image: sql`excluded.image`,
        link: sql`excluded.link`,
        lastSeenAt: sql`excluded.last_seen_at`,
        removedAt: sql`null`,
      },
    });

  // Whatever this read of the month no longer lists was taken off the page
  // (or renamed, which reads the same way): kept, but no longer shown.
  await db
    .update(table)
    .set({ removedAt: seenAt })
    .where(and(eq(table.period, key), lt(table.lastSeenAt, seenAt), isNull(table.removedAt)));

  return rows.length;
}

/**
 * The months worth re-reading on a given day: the previous one (entries are
 * still being added to a month that just ended, and its last days overlap the
 * new one), the current one and the next (published in its last days).
 */
export function monthsAround(at: Date): { year: number; month: number }[] {
  return [-1, 0, 1].map((delta) => {
    const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + delta, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  });
}

/** Every month from the first widget to the next one, for the backfill. */
export function allMonthlyPeriods(at: Date): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  const last = monthsAround(at)[2]!;
  for (let y: number = FIRST_MONTHLY_PERIOD.year, m: number = FIRST_MONTHLY_PERIOD.month; ; ) {
    out.push({ year: y, month: m });
    if (y === last.year && m === last.month) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
