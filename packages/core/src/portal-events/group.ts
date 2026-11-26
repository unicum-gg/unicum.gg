import { portalEventsByRegion, type PortalEventRow } from "@unicum.gg/shared";
import { REGIONS, Region } from "@unicum.gg/wargaming";
import { and, gt, isNull } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";

/**
 * One calendar entry as the community sees it: the same entry on several
 * regions is one entry, since the three portals usually publish an event with
 * the same article, title and dates (Black Friday 2026 was identical on all
 * three), and three copies of it differing by a prefix are noise.
 *
 * Regions whose dates differ stay apart, which is what an update does: 2.4.2
 * reached NA on the 24th and EU on the 25th, and merging them would publish a
 * date that is wrong for one of them.
 */
export type PortalEventGroup = {
  key: string;
  /** In `REGIONS` order, so EU leads when it is there. */
  regions: Region[];
  /** The leading region's row, which the title, link and banner are read from. */
  lead: PortalEventRow;
  rows: { region: Region; row: PortalEventRow }[];
};

const groupKey = (row: PortalEventRow) =>
  `${row.path}|${row.startAt.getTime()}|${row.endAt.getTime()}|${row.title}`;

/** Every entry that has not ended yet, grouped across the regions. */
export async function readOpenPortalEventGroups(
  now = new Date(),
): Promise<PortalEventGroup[]> {
  const groups = new Map<string, PortalEventGroup>();
  for (const region of REGIONS) {
    const table = portalEventsByRegion[region];
    const rows = await db
      .select()
      .from(table)
      .where(and(isNull(table.supersededAt), gt(table.endAt, now)));
    for (const row of rows) {
      const key = groupKey(row);
      const group = groups.get(key);
      if (group) {
        group.regions.push(region);
        group.rows.push({ region, row });
      } else {
        groups.set(key, { key, regions: [region], lead: row, rows: [{ region, row }] });
      }
    }
  }
  return [...groups.values()].sort(
    (a, b) => a.lead.startAt.getTime() - b.lead.startAt.getTime(),
  );
}

/** "EU · NA · ASIA", the regions an entry runs on. */
export const regionsLabel = (regions: Region[]) =>
  regions.map((region) => region.toUpperCase()).join(" · ");

/** Whether an entry is on every region, so its name needs no prefix. */
export const isEverywhere = (regions: Region[]) =>
  regions.length === REGIONS.length;
