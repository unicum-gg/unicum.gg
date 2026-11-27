import { portalEventsByRegion } from "@unicum.gg/shared";
import type { PortalCalendarEvent, Region } from "@unicum.gg/wargaming";
import { and, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { wg } from "@unicum.gg/core/wargaming/client";
import { PORTAL_EVENTS_LANGUAGE, PORTAL_EVENTS_LANGUAGES } from "./languages";
import { paced, readPastChallenge } from "./paced";
import { isPortalLink } from "./article-slug";

/**
 * The article a widget entry points at, without its language segment, so the
 * same entry read in French and in English lands on one key.
 * `https://worldoftanks.eu/fr/news/specials/x/` → `/news/specials/x/`.
 *
 * A link off the portal keeps its host (`www.tiktok.com/@x`): the editors link
 * outside Wargaming too, and two such links sharing a path are not one entry.
 * The portal's own host is dropped so the regions' copies of one article still
 * share a key, which is what groups them into one Discord event.
 */
export function articlePath(link: string, language: string): string {
  const url = new URL(link);
  const { pathname } = url;
  if (!isPortalLink(url)) return `${url.hostname}${pathname}`;
  const prefix = `/${language}/`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length - 1) : pathname;
}

const entryKey = (path: string, start: Date) => `${path}@${start.getTime()}`;

/**
 * The widget's titles in every other language the region publishes, keyed like
 * the English entries. A language that fails is skipped for this tick rather
 * than failing the capture: the English entry is what the calendar needs, the
 * translations fill in on the next hour. Read one at a time, a few seconds
 * apart, which makes the capture take about a minute a region.
 */
async function readTranslations(
  region: Region,
): Promise<Map<string, Record<string, string>>> {
  const titles = new Map<string, Record<string, string>>();
  const languages = PORTAL_EVENTS_LANGUAGES[region].filter(
    (language) => language !== PORTAL_EVENTS_LANGUAGE,
  );
  // One at a time, spaced: a burst of every language at once is what the
  // portal's bot shield answers with its interstitial (see `./paced`).
  for (const language of languages) {
    await paced();
    let entries: PortalCalendarEvent[];
    try {
      entries = await readPastChallenge(() =>
        wg.region(region).portal.events.calendar({ language }),
      );
    } catch (err) {
      console.warn(`[portal-events] ${region}/${language} unreadable: ${String(err)}`);
      continue;
    }
    for (const entry of entries) {
      const key = entryKey(articlePath(entry.link, language), entry.start);
      titles.set(key, { ...titles.get(key), [language]: entry.title });
    }
  }
  return titles;
}

/**
 * Read the article banners nobody has read yet. Once per entry: `''` records
 * an article without one, so it is not asked again every hour.
 */
async function fillBanners(region: Region, paths: string[]): Promise<void> {
  const table = portalEventsByRegion[region];
  const missing = await db
    .select({ path: table.path, startAt: table.startAt, link: table.link })
    .from(table)
    .where(and(inArray(table.path, paths), isNull(table.banner)));
  for (const row of missing) {
    try {
      await paced();
      const banner = await readPastChallenge(() =>
        wg.region(region).portal.events.articleImage({ link: row.link }),
      );
      await db
        .update(table)
        .set({ banner: banner ?? "" })
        .where(and(eq(table.path, row.path), eq(table.startAt, row.startAt)));
    } catch (err) {
      console.warn(`[portal-events] ${region} banner for ${row.path}:`, err);
    }
  }
}

/**
 * Record one region's widget. Returns how many entries it held.
 *
 * Throws when the English page cannot be read or carries no widget, so the
 * caller can tell "Wargaming changed the page" from "a quiet week": an empty
 * widget is an answer, a missing one is not.
 */
export async function capturePortalEvents(region: Region): Promise<number> {
  const table = portalEventsByRegion[region];
  const seenAt = new Date();
  const entries = await readPastChallenge(() =>
    wg.region(region).portal.events.calendar({ language: PORTAL_EVENTS_LANGUAGE }),
  );
  if (entries.length === 0) return 0;
  const translations = await readTranslations(region);

  const rows = entries.map((entry) => {
    const path = articlePath(entry.link, PORTAL_EVENTS_LANGUAGE);
    return {
      path,
      startAt: entry.start,
      endAt: entry.end,
      title: entry.title,
      titles: {
        ...translations.get(entryKey(path, entry.start)),
        [PORTAL_EVENTS_LANGUAGE]: entry.title,
      },
      category: entry.category,
      color: entry.color,
      icon: entry.icon,
      link: entry.link,
      thumbnail: entry.image,
      editedAt: entry.editedAt,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
    };
  });

  await db
    .insert(table)
    .values(rows)
    .onConflictDoUpdate({
      target: [table.path, table.startAt],
      set: {
        endAt: sql`excluded.end_at`,
        title: sql`excluded.title`,
        // Merged rather than replaced, so a language that failed this tick
        // keeps the title it was read with an hour ago.
        titles: sql`${table.titles} || excluded.titles`,
        category: sql`excluded.category`,
        color: sql`excluded.color`,
        icon: sql`excluded.icon`,
        link: sql`excluded.link`,
        thumbnail: sql`excluded.thumbnail`,
        editedAt: sql`excluded.edited_at`,
        lastSeenAt: sql`excluded.last_seen_at`,
        supersededAt: sql`null`,
      },
    });

  // The same article under another start that was NOT in this read, and should
  // still be showing (it has not ended): Wargaming moved the entry, and the old
  // row is the entry as it stood before. One that has ended is left alone,
  // since a two-part event under one article drops its first part exactly so.
  const paths = [...new Set(rows.map((row) => row.path))];
  for (const path of paths) {
    const starts = rows.filter((row) => row.path === path).map((row) => row.startAt);
    await db
      .update(table)
      .set({ supersededAt: seenAt })
      .where(
        and(
          eq(table.path, path),
          isNull(table.supersededAt),
          lt(table.lastSeenAt, seenAt),
          gt(table.endAt, seenAt),
          ...starts.map((start) => ne(table.startAt, start)),
        ),
      );
  }

  await fillBanners(region, paths);
  return rows.length;
}
