// Type-only, like `./index`: the component and style numbers below are written
// as the literals Discord documents, so nothing of this package loads at runtime.
import type {
  APIActionRowComponent,
  APIComponentInMessageActionRow,
  APIEmbed,
} from "discord-api-types/v10";
import { botFetch } from "./index";

/**
 * What the announcement channels post: a card that says what matters, and the
 * whole list in a thread under it.
 *
 * The four channels (the site's digest, the mod's releases, vehicle and map
 * changes) were walls of text, a week of the site running to two messages of
 * thirty lines at one level. So every one of them now posts the same shape:
 *
 *  - a ping of the channel's own role, never `@here`, so only the members who
 *    asked for that channel are notified;
 *  - one message of embeds carrying the headline and the few entries worth
 *    reading, with link buttons back to the site;
 *  - a thread under it holding everything, so the channel stays a column of
 *    cards and the discussion of a change happens beside it.
 *
 * The thread is also what makes following the channel from another server
 * work: a followed announcement copies the message alone, so a clan server gets
 * the card and nothing it has to scroll past.
 */

/** Each channel's accent, so a card says where it is from before it is read. */
export enum AnnouncementColor {
  Website = 0x3b82f6,
  Mod = 0xa855f7,
  /** A change that shipped. */
  Live = 0x22c55e,
  /** A change on the Common Test, which may never ship. */
  CommonTest = 0xf59e0b,
  Maps = 0x14b8a6,
}

/** Discord's own limits on one message. */
export const DISCORD_LIMITS = {
  content: 2000,
  embedsPerMessage: 10,
  /** Summed over every embed of a message. */
  embedTotal: 6000,
  description: 4096,
  fieldsPerEmbed: 25,
  fieldName: 256,
  fieldValue: 1024,
  title: 256,
  buttonsPerRow: 5,
  threadName: 100,
} as const;

export type LinkButton = { label: string; url: string };

export type Announcement = {
  embeds: APIEmbed[];
  /** Links back to the site, at most one row of five. */
  buttons?: LinkButton[];
  /** The role to ping, or null to post without one. */
  pingRoleId?: string | null;
  /** A line beside the ping, for a post of several embeds that needs a title
   * above all of them. */
  content?: string;
  /** The full list, posted in a thread opened on the message. Omitted when the
   * card already says everything. */
  thread?: { name: string; messages: string[] };
};

/** Cut a string to a Discord limit, marking the cut. */
export function clamp(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** What an embed counts against the 6000 a message may hold. */
export function embedLength(embed: APIEmbed): number {
  return (
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.author?.name.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    (embed.fields ?? []).reduce(
      (sum, f) => sum + f.name.length + f.value.length,
      0,
    )
  );
}

/**
 * Pack blocks into messages under Discord's 2000 characters, never splitting a
 * block. A block is one unit a reader takes in at once (a vehicle and its
 * `diff`, a release section), so cutting one in the middle would break a code
 * fence and leave half of it in the next message. A single block over the
 * limit, which none should be, is clamped rather than dropped.
 */
export function packBlocks(blocks: string[]): string[] {
  const messages: string[] = [];
  let current = "";
  for (const raw of blocks) {
    const block = clamp(raw, DISCORD_LIMITS.content);
    const joined = current ? `${current}\n\n${block}` : block;
    if (joined.length <= DISCORD_LIMITS.content) {
      current = joined;
      continue;
    }
    if (current) messages.push(current);
    current = block;
  }
  if (current) messages.push(current);
  return messages;
}

function buttonRow(
  buttons: LinkButton[],
): APIActionRowComponent<APIComponentInMessageActionRow>[] {
  if (buttons.length === 0) return [];
  return [
    {
      // An action row (1) of link buttons (2, style 5): a link button needs no
      // handler on the gateway side, which is why these are the only kind used.
      type: 1,
      components: buttons
        .slice(0, DISCORD_LIMITS.buttonsPerRow)
        .map((b) => ({
          type: 2,
          style: 5,
          label: clamp(b.label, 80),
          url: b.url,
        })),
    },
  ];
}

/**
 * Post an announcement: the card, its publication to the servers following the
 * channel, and the thread.
 *
 * Answers with the message id once the card is posted, which is the moment the
 * announcement counts as made: the publication and the thread are best-effort
 * and only logged, since reposting the card because its thread failed would
 * tell the channel the same thing twice. Null when the card itself did not
 * post, which every caller treats as "try again next run".
 */
export async function postAnnouncement(
  channelId: string,
  announcement: Announcement,
): Promise<string | null> {
  const role = announcement.pingRoleId ?? null;
  const message = await botFetch<{ id: string }>(
    `/channels/${channelId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content:
          [role ? `<@&${role}>` : "", announcement.content ?? ""]
            .filter(Boolean)
            .join(" ") || undefined,
        embeds: announcement.embeds,
        components: buttonRow(announcement.buttons ?? []),
        // Only the channel's own role may ping: an entry quoting `@here` from a
        // release note must stay text.
        allowed_mentions: { parse: [], roles: role ? [role] : [] },
      }),
    },
  );
  if (!message?.id) return null;

  // Publishing is what copies the card into the servers that follow the
  // channel. Discord answers 400 outside an announcement channel, which is a
  // configuration the post above already survived, so it is only logged.
  const published = await botFetch(
    `/channels/${channelId}/messages/${message.id}/crosspost`,
    { method: "POST" },
  );
  if (!published) {
    console.warn(
      `[announce] ${message.id} posted but not published to followers (not an announcement channel?)`,
    );
  }

  const thread = announcement.thread;
  if (thread && thread.messages.length > 0) {
    const opened = await botFetch<{ id: string }>(
      `/channels/${channelId}/messages/${message.id}/threads`,
      {
        method: "POST",
        body: JSON.stringify({
          name: clamp(thread.name, DISCORD_LIMITS.threadName),
          // A week: long enough to be found again from the card, short enough
          // that a channel's old threads leave the active list on their own.
          auto_archive_duration: 10080,
        }),
      },
    );
    if (!opened?.id) {
      console.error(`[announce] ${message.id} posted but its thread did not open`);
      return message.id;
    }
    for (const [i, content] of thread.messages.entries()) {
      const posted = await botFetch(`/channels/${opened.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      });
      if (!posted) {
        console.error(
          `[announce] thread part ${i + 1}/${thread.messages.length} of ${message.id} did not post`,
        );
        break;
      }
    }
  }
  return message.id;
}

/**
 * The announcement as plain text, for the dry runs: a person reading a terminal
 * needs to see what the card and the thread will say, not their JSON.
 */
export function describeAnnouncement(announcement: Announcement): string {
  const out: string[] = [];
  const head = [
    announcement.pingRoleId ? `@role ${announcement.pingRoleId}` : "",
    announcement.content ?? "",
  ].filter(Boolean);
  if (head.length > 0) out.push(head.join(" "));
  for (const embed of announcement.embeds) {
    out.push("┌─ embed");
    if (embed.author?.name) out.push(`│ ${embed.author.name}`);
    if (embed.title) out.push(`│ # ${embed.title}${embed.url ? `  <${embed.url}>` : ""}`);
    if (embed.description) {
      out.push(...embed.description.split("\n").map((l) => `│ ${l}`));
    }
    for (const field of embed.fields ?? []) {
      out.push(`│ ## ${field.name}${field.inline ? " (inline)" : ""}`);
      out.push(...field.value.split("\n").map((l) => `│   ${l}`));
    }
    if (embed.image?.url) out.push(`│ [image] ${embed.image.url}`);
    if (embed.thumbnail?.url) out.push(`│ [thumbnail] ${embed.thumbnail.url}`);
    if (embed.footer?.text) out.push(`│ footer: ${embed.footer.text}`);
    out.push(`└─ ${embedLength(embed)} chars`);
  }
  for (const b of announcement.buttons ?? []) out.push(`[${b.label}] ${b.url}`);
  const thread = announcement.thread;
  if (thread) {
    out.push(`\n=== thread: ${thread.name} (${thread.messages.length} messages)`);
    thread.messages.forEach((m, i) => out.push(`--- ${i + 1}`, m));
  }
  return out.join("\n");
}
