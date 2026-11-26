import { env, portalEventsByRegion } from "@unicum.gg/shared";
import { and, eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { botFetch, discordBotEnabled } from "@unicum.gg/core/discord";
import {
  describeAnnouncement,
  postAnnouncement,
} from "@unicum.gg/core/discord/announce";
import {
  eventAnnouncement,
  eventBody,
  eventDue,
  eventHash,
} from "./discord";
import { readOpenPortalEventGroups, type PortalEventGroup } from "./group";

/** Discord's scheduled event status for one already running. */
const EVENT_ACTIVE = 2;

/**
 * A card for an entry that began longer ago than this is not posted: that is
 * the first run after a deploy, or an outage, and pinging a role about an event
 * a week into its run tells nobody anything. The event itself is still created.
 */
const CARD_MAX_LATE_MS = 24 * 60 * 60 * 1000;

/** `discord_message_id` of an entry deliberately never announced. */
const NOT_ANNOUNCED = "";

/**
 * The card pings a role, so it waits for daytime in the community's timezone,
 * the window the other announcers keep. The scheduled event pings nobody and is
 * created whenever the entry is read.
 */
function announcingHours(now: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return hour >= 9 && hour <= 22;
}

export function portalEventsPublishingEnabled(): boolean {
  return discordBotEnabled() && Boolean(env.DISCORD_GUILD_ID);
}

const eventUrl = (eventId: string) =>
  `https://discord.com/events/${env.DISCORD_GUILD_ID}/${eventId}`;

async function updateRows(
  group: PortalEventGroup,
  set: Partial<{
    discordEventId: string;
    discordSyncedHash: string;
    discordMessageId: string;
  }>,
): Promise<void> {
  for (const { region, row } of group.rows) {
    const table = portalEventsByRegion[region];
    await db
      .update(table)
      .set(set)
      .where(and(eq(table.path, row.path), eq(table.startAt, row.startAt)));
  }
}

/** The banner as a data URI, which is the only way Discord takes an event cover. */
async function bannerImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Create the entry's scheduled event, or rewrite it when the entry changed. */
async function syncEvent(
  group: PortalEventGroup,
  now: Date,
  dry: boolean,
  log: string[],
): Promise<string | null> {
  const guild = env.DISCORD_GUILD_ID;
  const existing = group.rows.find(({ row }) => row.discordEventId)?.row.discordEventId ?? null;
  if (!eventDue(group, now)) return existing;
  const hash = eventHash(group);
  const synced = group.rows.every(({ row }) => row.discordSyncedHash === hash);
  if (existing && synced) return existing;

  if (!existing) {
    const body = eventBody(group, now);
    if (dry) {
      log.push(`create event: ${body.name}\n  ${body.scheduled_start_time} → ${body.scheduled_end_time}\n  ${body.description.replaceAll("\n", "\n  ")}`);
      return null;
    }
    const created = await botFetch<{ id: string }>(`/guilds/${guild}/scheduled-events`, {
      method: "POST",
      body: JSON.stringify(eventBody(group, now, { image: await bannerImage(group.lead.banner) })),
    });
    if (!created?.id) {
      log.push(`event not created: ${body.name}`);
      return null;
    }
    await updateRows(group, { discordEventId: created.id, discordSyncedHash: hash });
    log.push(`created event ${created.id}: ${body.name}`);
    return created.id;
  }

  if (dry) {
    log.push(`update event ${existing}: ${eventBody(group, now).name}`);
    return existing;
  }
  const current = await botFetch<{ status: number }>(
    `/guilds/${guild}/scheduled-events/${existing}`,
  );
  if (!current) {
    // Deleted by a moderator, or Discord did not answer. Recreating it would
    // undo a deliberate removal, so the entry is left as it is.
    log.push(`event ${existing} unreachable, left alone`);
    return existing;
  }
  const updated = await botFetch(`/guilds/${guild}/scheduled-events/${existing}`, {
    method: "PATCH",
    body: JSON.stringify(eventBody(group, now, { started: current.status === EVENT_ACTIVE })),
  });
  if (updated) {
    await updateRows(group, { discordSyncedHash: hash });
    log.push(`updated event ${existing}`);
  }
  return existing;
}

/** Post the entry's card, once. */
async function syncCard(
  group: PortalEventGroup,
  eventId: string | null,
  now: Date,
  dry: boolean,
  log: string[],
): Promise<void> {
  const channel = env.DISCORD_EVENTS_CHANNEL_ID;
  if (!channel) return;
  if (group.rows.some(({ row }) => row.discordMessageId !== null)) return;
  if (now.getTime() - group.lead.startAt.getTime() > CARD_MAX_LATE_MS) {
    if (!dry) await updateRows(group, { discordMessageId: NOT_ANNOUNCED });
    log.push(`not announced (began too long ago): ${group.lead.title}`);
    return;
  }
  if (!dry && !announcingHours(now)) return;
  const card = eventAnnouncement(group, {
    pingRoleId: env.DISCORD_EVENTS_ROLE_ID ?? null,
    eventUrl: eventId ? eventUrl(eventId) : null,
  });
  if (dry) {
    log.push(describeAnnouncement(card));
    return;
  }
  const messageId = await postAnnouncement(channel, card);
  if (messageId) {
    await updateRows(group, { discordMessageId: messageId });
    log.push(`announced ${messageId}: ${group.lead.title}`);
  }
}

/**
 * Publish every open calendar entry to the community server: a scheduled event
 * per entry, and a card in the events channel the first time it is seen.
 * `dry` writes nothing and returns what would be done.
 */
export async function publishPortalEvents({
  dry = false,
}: { dry?: boolean } = {}): Promise<string[]> {
  const log: string[] = [];
  const now = new Date();
  for (const group of await readOpenPortalEventGroups(now)) {
    try {
      const eventId = await syncEvent(group, now, dry, log);
      await syncCard(group, eventId, now, dry, log);
    } catch (err) {
      log.push(`failed: ${group.lead.title} (${String(err)})`);
    }
  }
  return log;
}
