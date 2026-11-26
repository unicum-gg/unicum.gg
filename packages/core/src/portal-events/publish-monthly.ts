import { createHash } from "node:crypto";
import {
  CalendarKind,
  calendarKind,
  env,
  portalEventsByRegion,
  portalMonthlyEventsByRegion,
  type PortalMonthlyEventRow,
} from "@unicum.gg/shared";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { botFetch } from "@unicum.gg/core/discord";
import { clamp } from "@unicum.gg/core/discord/announce";
import {
  calendarUrlForRegions,
  emoji,
  EVENT_LIMITS,
  LATE_START_MS,
} from "./discord";
import { bannerImage, EVENT_ACTIVE } from "./publish";
import { articleSlug } from "./article-slug";

/**
 * The monthly articles' entries as Discord scheduled events, all-day.
 *
 * Only the kinds a reader plays or watches: an event, a tournament, a
 * broadcast, an update. Not the Specials, which are sales and partner offers
 * (a month of Boosteroid rewards is not something to be reminded of on the
 * day), nor the Battle Pass, which the home widget already carries with its
 * times. No card either: an article lands about ten entries at once on the
 * first of the month, and ten pings in a row would teach the role to mute
 * itself. The scheduled event pings nobody, and reminds whoever asked to be.
 */
const PUBLISHED = new Set([
  CalendarKind.Event,
  CalendarKind.Competitive,
  CalendarKind.Livestream,
  CalendarKind.Update,
]);

const DAY_MS = 86_400_000;
const utcDay = (date: string) => new Date(`${date}T00:00:00Z`);

/** A monthly entry the widget turned out to carry too, whose event was made
 * before the widget's copy appeared: removed, the widget's event stays. */
type Twin = { region: Region; row: PortalMonthlyEventRow };

type MonthlyGroup = {
  /** Start, end and title: what makes two regions' rows one entry. */
  key: string;
  regions: Region[];
  lead: PortalMonthlyEventRow;
  /** Every row of the entry, repeats in later months included. */
  rows: { region: Region; row: PortalMonthlyEventRow }[];
};

/** The entries to publish: open, of a published kind, not already a widget
 * entry, one per entry across regions and months. */
async function readMonthlyGroups(now: Date): Promise<{ groups: MonthlyGroup[]; twins: Twin[] }> {
  const today = now.toISOString().slice(0, 10);
  const groups = new Map<string, MonthlyGroup>();
  const twins: Twin[] = [];
  for (const region of REGIONS) {
    const table = portalMonthlyEventsByRegion[region];
    const widget = portalEventsByRegion[region];
    const [rows, widgetRows] = await Promise.all([
      db.select().from(table).where(and(isNull(table.removedAt), gte(table.endDate, today))),
      db
        .select({ link: widget.link, startAt: widget.startAt, endAt: widget.endAt })
        .from(widget)
        .where(isNull(widget.supersededAt)),
    ]);
    for (const row of rows) {
      if (!PUBLISHED.has(calendarKind(row.icon))) continue;
      const start = utcDay(row.startDate);
      const end = new Date(utcDay(row.endDate).getTime() + DAY_MS);
      const slug = articleSlug(row.link);
      // The widget publishes this one already, with its times.
      if (
        slug &&
        widgetRows.some((w) => articleSlug(w.link) === slug && w.startAt < end && w.endAt > start)
      ) {
        if (row.discordEventId) twins.push({ region, row });
        continue;
      }
      const key = `${row.startDate}|${row.title}`;
      const group = groups.get(key);
      if (!group) {
        groups.set(key, { key, regions: [region], lead: row, rows: [{ region, row }] });
        continue;
      }
      if (!group.regions.includes(region)) group.regions.push(region);
      group.rows.push({ region, row });
      // The latest article's copy leads: the editors touched it last.
      if (row.period > group.lead.period) group.lead = row;
    }
  }
  return { groups: [...groups.values()], twins };
}

const regionsLabel = (regions: Region[]) => regions.map((r) => r.toUpperCase()).join(" · ");

function window(group: MonthlyGroup, now: Date): { start: Date; end: Date } {
  const start = utcDay(group.lead.startDate);
  // The last day ends a minute before midnight UTC, so the event reads as the
  // whole day rather than spilling into the next.
  const end = new Date(utcDay(group.lead.endDate).getTime() + DAY_MS - 60_000);
  const earliest = new Date(now.getTime() + LATE_START_MS);
  return { start: start < earliest ? earliest : start, end };
}

function eventName(group: MonthlyGroup): string {
  const prefix = group.regions.length === REGIONS.length ? "" : `[${regionsLabel(group.regions)}] `;
  return clamp(`${prefix}${group.lead.title}`, EVENT_LIMITS.name);
}

function eventDescription(group: MonthlyGroup): string {
  const { lead } = group;
  const day = (date: string) =>
    utcDay(date).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
  const dates =
    lead.startDate === lead.endDate ? day(lead.startDate) : `${day(lead.startDate)} to ${day(lead.endDate)}`;
  const text = lead.descriptions.en?.split("\n\n")[0] ?? "";
  const lines = [
    `${emoji(lead.icon)} ${lead.category} · ${regionsLabel(group.regions)}`,
    `${dates} (all day: Wargaming dates it by the day)`,
  ];
  if (text) lines.push("", text);
  lines.push("", "Source: WoT Monthly");
  if (lead.link) lines.push(lead.link);
  lines.push("", `Every event, day by day: ${calendarUrlForRegions(group.regions)}`);
  return clamp(lines.join("\n"), EVENT_LIMITS.description);
}

function eventHash(group: MonthlyGroup, now: Date): string {
  const { end } = window(group, now);
  return createHash("sha1")
    .update([eventName(group), group.lead.startDate, end.toISOString(), group.lead.link ?? "", group.regions.join()].join("|"))
    .digest("hex");
}

function eventBody(group: MonthlyGroup, now: Date, opts: { image?: string | null; started?: boolean } = {}) {
  const { start, end } = window(group, now);
  // An entry with no page to send to is located at our calendar, which has it.
  const location = group.lead.link ?? calendarUrlForRegions(group.regions);
  return {
    name: eventName(group),
    description: eventDescription(group),
    privacy_level: 2,
    entity_type: 3,
    entity_metadata: { location: clamp(location, EVENT_LIMITS.location) },
    ...(opts.started ? {} : { scheduled_start_time: start.toISOString() }),
    scheduled_end_time: end.toISOString(),
    ...(opts.image ? { image: opts.image } : {}),
  };
}

async function updateRows(
  group: MonthlyGroup,
  set: Partial<{ discordEventId: string; discordSyncedHash: string }>,
): Promise<void> {
  for (const { region, row } of group.rows) {
    const table = portalMonthlyEventsByRegion[region];
    await db
      .update(table)
      .set(set)
      .where(
        and(eq(table.period, row.period), eq(table.startDate, row.startDate), eq(table.title, row.title)),
      );
  }
}

/** Publish the open monthly entries as scheduled events. `dry` writes nothing. */
export async function publishMonthlyEvents({ dry = false }: { dry?: boolean } = {}): Promise<string[]> {
  const log: string[] = [];
  const guild = env.DISCORD_GUILD_ID;
  const now = new Date();
  const { groups, twins } = await readMonthlyGroups(now);
  for (const id of new Set(twins.map((t) => t.row.discordEventId!))) {
    if (dry) {
      log.push(`delete monthly event ${id}: the widget carries it`);
      continue;
    }
    // A 404 means it is already gone, which is the same outcome.
    await botFetch(`/guilds/${guild}/scheduled-events/${id}`, { method: "DELETE" });
    // Every row that pointed at it lets go, the twins' and those of regions
    // whose widget does not carry the entry (they get an event of their own).
    for (const region of REGIONS) {
      const table = portalMonthlyEventsByRegion[region];
      await db
        .update(table)
        .set({ discordEventId: null, discordSyncedHash: null })
        .where(eq(table.discordEventId, id));
    }
    log.push(`deleted monthly event ${id}: the widget carries it`);
  }
  const deleted = new Set(twins.map((t) => t.row.discordEventId!));
  for (const group of groups) {
    for (const { row } of group.rows) {
      if (row.discordEventId && deleted.has(row.discordEventId)) {
        row.discordEventId = null;
        row.discordSyncedHash = null;
      }
    }
    try {
      const existing = group.rows.find(({ row }) => row.discordEventId)?.row.discordEventId ?? null;
      const hash = eventHash(group, now);
      if (existing && group.rows.every(({ row }) => row.discordSyncedHash === hash)) continue;
      const body = eventBody(group, now);
      if (dry) {
        log.push(
          `${existing ? `update event ${existing}` : "create event"}: ${body.name}\n  ${body.scheduled_start_time} → ${body.scheduled_end_time}\n  ${body.description.replaceAll("\n", "\n  ")}`,
        );
        continue;
      }
      if (!existing) {
        const created = await botFetch<{ id: string }>(`/guilds/${guild}/scheduled-events`, {
          method: "POST",
          body: JSON.stringify(eventBody(group, now, { image: await bannerImage(group.lead.image) })),
        });
        if (!created?.id) {
          log.push(`monthly event not created: ${body.name}`);
          continue;
        }
        await updateRows(group, { discordEventId: created.id, discordSyncedHash: hash });
        log.push(`created monthly event ${created.id}: ${body.name}`);
        continue;
      }
      const current = await botFetch<{ status: number }>(`/guilds/${guild}/scheduled-events/${existing}`);
      // Deleted by a moderator, or Discord did not answer: left alone, since
      // recreating it would undo a deliberate removal.
      if (!current) continue;
      const updated = await botFetch(`/guilds/${guild}/scheduled-events/${existing}`, {
        method: "PATCH",
        body: JSON.stringify(eventBody(group, now, { started: current.status === EVENT_ACTIVE })),
      });
      if (updated) {
        await updateRows(group, { discordSyncedHash: hash });
        log.push(`updated monthly event ${existing}`);
      }
    } catch (err) {
      log.push(`failed: ${group.lead.title} (${String(err)})`);
    }
  }
  return log;
}
