import { createHash } from "node:crypto";
import { APP_IDENTITY } from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import type { Announcement } from "@unicum.gg/core/discord/announce";
import { clamp } from "@unicum.gg/core/discord/announce";
import { isEverywhere, regionsLabel, type PortalEventGroup } from "./group";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Discord's limits on a scheduled event. */
export const EVENT_LIMITS = { name: 100, description: 1000, location: 100 } as const;

/**
 * An update is published as a one-minute entry (07:30 to 07:31) marking the
 * moment it goes live, and Discord requires an event to end. Two hours is what
 * the servers' maintenance usually takes.
 */
const POINT_ENTRY_MS = 10 * MINUTE_MS;
const POINT_EVENT_MS = 2 * HOUR_MS;

/**
 * A Battle Pass season runs for about three months, and as an event it would
 * sit at the top of the server's list for all of them. Its card goes out when it
 * starts, and its event only covers the last week, where "it ends soon" is the
 * part worth a notification.
 */
const LONG_ENTRY_ICON = "battle-pass";
const LONG_EVENT_MS = 7 * DAY_MS;

/**
 * Discord refuses an event starting in the past, which every entry first seen
 * after it began would be (a week underway, or the first run after a deploy).
 * Those open a couple of minutes after they are created, and say when they
 * really began.
 */
export const LATE_START_MS = 2 * MINUTE_MS;

/** The widget's style tokens, as card accents and emoji. */
const COLOR: Record<string, number> = {
  green: 0x22c55e,
  azure: 0x0ea5e9,
  yellow: 0xf5b82e,
  red: 0xef4444,
};
const ICON: Record<string, string> = {
  "battle-pass": "🎖️",
  star: "⭐",
  "calendar-days": "📅",
  calendar: "📅",
  swords: "⚔️",
  "signal-stream": "📺",
  "arrow-down-to-line": "🛠️",
};
export const emoji = (icon: string) => ICON[icon] ?? "📅";

/** When the event runs, which is not always when the entry does. */
export function eventWindow(group: PortalEventGroup): { start: Date; end: Date } {
  const { startAt, endAt, icon } = group.lead;
  if (endAt.getTime() - startAt.getTime() < POINT_ENTRY_MS) {
    return { start: startAt, end: new Date(startAt.getTime() + POINT_EVENT_MS) };
  }
  if (icon === LONG_ENTRY_ICON) {
    const lastWeek = endAt.getTime() - LONG_EVENT_MS;
    return { start: new Date(Math.max(startAt.getTime(), lastWeek)), end: endAt };
  }
  return { start: startAt, end: endAt };
}

/**
 * Whether the event should exist yet. Everything else is created the hour it is
 * read, which is the notice the community gets; a Battle Pass waits until a day
 * before its last week.
 */
export function eventDue(group: PortalEventGroup, now: Date): boolean {
  if (group.lead.icon !== LONG_ENTRY_ICON) return true;
  return eventWindow(group).start.getTime() - now.getTime() <= DAY_MS;
}

export function eventName(group: PortalEventGroup): string {
  const prefix = isEverywhere(group.regions) ? "" : `[${regionsLabel(group.regions)}] `;
  return clamp(`${prefix}${group.lead.title}`, EVENT_LIMITS.name);
}

const utc = (at: Date) =>
  at.toLocaleString("en-GB", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " UTC";

/**
 * Our calendar page for the entry's regions: the region's own when it runs on
 * one, the region-less page (EU's) when it runs on several. Every event and
 * card links back to it, which is the point of announcing on our server.
 */
export function calendarPageUrl(group: PortalEventGroup): string {
  return calendarUrlForRegions(group.regions);
}

/** The same, from the regions alone (the monthly entries have no widget group). */
export function calendarUrlForRegions(regions: Region[]): string {
  const only = regions.length === 1 ? regions[0] : null;
  const path = only && only !== Region.EU ? `/${only}/calendar` : "/calendar";
  return `${APP_IDENTITY.URL}${path}`;
}

function eventDescription(group: PortalEventGroup): string {
  const { lead } = group;
  const lines = [`${emoji(lead.icon)} ${lead.category} · ${regionsLabel(group.regions)}`];
  lines.push(`${utc(lead.startAt)} to ${utc(lead.endAt)}`);
  lines.push("", "Source: official Wargaming calendar", lead.link);
  lines.push("", `Every event, day by day: ${calendarPageUrl(group)}`);
  return clamp(lines.join("\n"), EVENT_LIMITS.description);
}

/**
 * What the event is written from. The sync compares it with the hash stored on
 * the rows, so an entry Wargaming edits is rewritten once and a re-read of the
 * same entry costs nothing.
 */
export function eventHash(group: PortalEventGroup): string {
  const { start, end } = eventWindow(group);
  return createHash("sha1")
    .update(
      [
        eventName(group),
        start.toISOString(),
        end.toISOString(),
        group.lead.link,
        group.regions.join(),
        calendarPageUrl(group),
      ].join("|"),
    )
    .digest("hex");
}

/**
 * The scheduled event's body. `image` is the banner as a data URI, sent on
 * creation only. `started` drops the start, which Discord does not let an event
 * already running change.
 */
export function eventBody(
  group: PortalEventGroup,
  now: Date,
  { image, started = false }: { image?: string | null; started?: boolean } = {},
) {
  const window = eventWindow(group);
  const earliest = new Date(now.getTime() + LATE_START_MS);
  const start = window.start < earliest ? earliest : window.start;
  return {
    name: eventName(group),
    description: eventDescription(group),
    privacy_level: 2,
    entity_type: 3,
    entity_metadata: { location: clamp(group.lead.link, EVENT_LIMITS.location) },
    ...(started ? {} : { scheduled_start_time: start.toISOString() }),
    scheduled_end_time: window.end.toISOString(),
    ...(image ? { image } : {}),
  };
}

const stamp = (at: Date) => Math.floor(at.getTime() / 1000);

/** The card posted in the events channel when an entry first appears. */
export function eventAnnouncement(
  group: PortalEventGroup,
  {
    pingRoleId,
    eventUrl,
  }: { pingRoleId: string | null; eventUrl: string | null },
): Announcement {
  const { lead } = group;
  const start = stamp(lead.startAt);
  const end = stamp(lead.endAt);
  const point = lead.endAt.getTime() - lead.startAt.getTime() < POINT_ENTRY_MS;
  return {
    pingRoleId,
    embeds: [
      {
        color: COLOR[lead.color] ?? COLOR.yellow,
        author: {
          name: `${emoji(lead.icon)} ${lead.category.toUpperCase()} · ${regionsLabel(group.regions)}`,
        },
        title: clamp(lead.title, 256),
        url: lead.link,
        fields: point
          ? [{ name: "When", value: `<t:${start}:F>\n<t:${start}:R>`, inline: true }]
          : [
              { name: "Starts", value: `<t:${start}:F>\n<t:${start}:R>`, inline: true },
              { name: "Ends", value: `<t:${end}:F>\n<t:${end}:R>`, inline: true },
            ],
        ...(lead.banner ? { image: { url: lead.banner } } : {}),
        footer: { text: "Source: official Wargaming calendar" },
      },
    ],
    buttons: [
      { label: "Read the news", url: lead.link },
      ...(eventUrl ? [{ label: "Event", url: eventUrl }] : []),
      { label: "Calendar", url: calendarPageUrl(group) },
    ],
  };
}
