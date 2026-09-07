import { APP_IDENTITY, BRAND_COLOR_INT, youtubeThumbnailUrl } from "@unicum.gg/shared";
import { sendDirectMessage } from "@unicum.gg/core/discord";
import { getDiscordUserId } from "@unicum.gg/core/discord/supporter-role";

/**
 * Telling a submitter what became of their suggestion.
 *
 * A verdict used to happen entirely out of their sight: the row changed status,
 * and the person who sent it either found their video on the page one day or
 * never heard anything at all. A rejection was the worse half, since the one
 * thing that would let them fix it lived in the moderator's head.
 *
 * Sent as a direct message, and only to submitters who linked their Discord
 * account, which most have not: this is a courtesy on top of the site, never
 * the record. What the site shows them stays the answer, so nothing here may
 * fail a review or hold one up.
 */

/** Red rather than the brand colour, so the two verdicts do not read alike in a
 * glance at a notification. */
const REJECTED_COLOR = 0xef4444;

export type AuthorNotice = {
  /** Better Auth id of the submitter. Null once the account is deleted, which
   * takes nobody to tell. */
  userId: string | null;
  title: string;
  videoId: string;
  approved: boolean;
  /** Where it is now live, on an approval. */
  url?: string | null;
  /** Why it was turned down, in the moderator's words. */
  note?: string | null;
};

/**
 * Best-effort, and silent on every ordinary miss: an author who never linked
 * Discord, a bot that shares no server with them, DMs refused. Only a genuine
 * failure is logged, and even that is swallowed by the caller.
 */
export async function notifyVideoAuthor(notice: AuthorNotice): Promise<void> {
  if (!notice.userId) return;
  const discordUserId = await getDiscordUserId(notice.userId);
  if (!discordUserId) return;

  const fields = notice.approved
    ? notice.url
      ? [{ name: "Where it is", value: notice.url, inline: false }]
      : []
    : [
        {
          name: "Why",
          // The one field worth having, and the reason the button now asks for
          // it. The fallback is honest rather than reassuring: a rejection
          // recorded without a reason has none to give.
          value: notice.note?.trim()
            ? notice.note.trim()
            : "No reason was recorded.",
          inline: false,
        },
        {
          name: "What you can do",
          value:
            "Correct it from your own queue on the site and it goes back for review. Most rejections are a timestamp or a map, not the video.",
          inline: false,
        },
      ];

  await sendDirectMessage(discordUserId, {
    title: notice.approved
      ? "Your video is live"
      : "Your video was not published",
    description: notice.title,
    color: notice.approved ? BRAND_COLOR_INT : REJECTED_COLOR,
    thumbnail: { url: youtubeThumbnailUrl(notice.videoId) },
    fields,
    footer: { text: APP_IDENTITY.NAME },
  }).catch((err) =>
    console.error("[tank-videos] author notice failed:", err),
  );
}
