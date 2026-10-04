import { APP_IDENTITY, BRAND_COLOR_INT } from "@unicum.gg/shared";
import {
  quoteBack,
  REJECTED_COLOR,
  sendAuthorNotice,
} from "@unicum.gg/core/community/author-notice";

/**
 * Telling someone what became of the opinion they wrote under their stars.
 *
 * The video queue has told its submitters for a while and this one never did,
 * which left the slower half of the two silent: the stars land on the page
 * immediately, so an author who also wrote something has no way to tell a
 * moderator has not read it yet from a moderator having turned it down. They
 * found out by coming back to the tank page, if they came back.
 *
 * Both verdicts are worth a message, and the rejection says the thing the
 * author cannot work out on their own: the vote is untouched. Only the sentence
 * was withdrawn, so their stars are still in the average they can see.
 */

export type RatingAuthorNotice = {
  /** Better Auth id of the author. */
  userId: string | null;
  /** The vehicle they rated, or null when it has left the catalogue. */
  tankName: string | null;
  /** What they wrote, quoted back: a reader may have several opinions waiting,
   * and the tank's name alone does not say which one this is. */
  review: string | null;
  approved: boolean;
  /** The tank's Community tab, which is both where a published opinion now
   * shows and where a rejected one is rewritten. Null when the slug could not
   * be resolved. */
  url?: string | null;
};

export async function notifyRatingAuthor(
  notice: RatingAuthorNotice,
): Promise<void> {
  const rewrite =
    "Your stars still count towards the average. Only the text came down, and you can write another one from the tank page.";

  await sendAuthorNotice({
    userId: notice.userId,
    scope: "tank-ratings",
    embed: {
      title: notice.approved
        ? "Your review is live"
        : "Your review was not published",
      // The vehicle first, then their own words under it. The name is in the
      // body rather than the title because it is the one part that can be
      // missing, and a title assembled around a null reads as a bug.
      description: [
        notice.tankName ? `**${notice.tankName}**` : null,
        notice.review?.trim() ? quoteBack(notice.review.trim()) : null,
      ]
        .filter(Boolean)
        .join("\n"),
      color: notice.approved ? BRAND_COLOR_INT : REJECTED_COLOR,
      fields: notice.approved
        ? notice.url
          ? [{ name: "Where it is", value: notice.url, inline: false }]
          : []
        : [
            {
              name: "What you can do",
              value: notice.url ? `${rewrite}\n${notice.url}` : rewrite,
              inline: false,
            },
          ],
      footer: { text: APP_IDENTITY.NAME },
    },
  });
}
