import type { APIEmbed } from "discord-api-types/v10";
import { sendDirectMessage } from "@unicum.gg/core/discord";
import { getDiscordUserId } from "@unicum.gg/core/discord/supporter-role";

/**
 * Telling a contributor what became of what they sent.
 *
 * Shared by every moderated queue, the suggested videos and the written half of
 * a vehicle or a map rating, because the delivery is the same in all of them and
 * the thing that must stay the same is what happens when it cannot be
 * delivered. A notice is a courtesy on top of the site, never the record: what
 * the site shows the author stays the answer, so nothing here may fail a review
 * or hold one up.
 */

/** Red rather than the brand colour, so the two verdicts do not read alike in a
 * glance at a notification. */
export const REJECTED_COLOR = 0xef4444;

/**
 * Send one, best-effort, and silent on every ordinary miss: an author who never
 * linked Discord, a bot that shares no server with them, DMs refused. Only a
 * genuine failure is logged, and it never reaches the caller.
 */
export async function sendAuthorNotice(notice: {
  /** Better Auth id of the author. Null once the account is deleted, which
   * takes nobody to tell. */
  userId: string | null;
  /** Which queue this came from, so the one log line a real failure earns says
   * which one. */
  scope: string;
  embed: APIEmbed;
}): Promise<void> {
  if (!notice.userId) return;
  const discordUserId = await getDiscordUserId(notice.userId);
  if (!discordUserId) return;

  await sendDirectMessage(discordUserId, notice.embed).catch((err) =>
    console.error(`[${notice.scope}] author notice failed:`, err),
  );
}

/**
 * The author's own words, quoted back so a notice names which of them it is
 * about.
 *
 * Markdown-quoted line by line: Discord's blockquote only covers the line it
 * starts, so a paragraph break would drop out of the quote and read as the
 * notice talking rather than the author.
 */
export function quoteBack(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}
