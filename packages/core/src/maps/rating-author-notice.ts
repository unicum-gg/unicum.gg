import { APP_IDENTITY, BRAND_COLOR_INT } from "@unicum.gg/shared";
import {
  quoteBack,
  REJECTED_COLOR,
  sendAuthorNotice,
} from "@unicum.gg/core/community/author-notice";

/**
 * Telling someone what became of the opinion they wrote under their stars.
 *
 * The delivery is shared with the two queues that came before (see
 * `community/author-notice`): a notice is a courtesy on top of the site, never the
 * record, so nothing here may fail a review or hold one up.
 *
 * Both verdicts are worth a message, and the rejection says the thing the
 * author cannot work out on their own: the vote is untouched. Only the sentence
 * was withdrawn, so their stars are still in the average they can see.
 */

export type MapRatingAuthorNotice = {
  /** Better Auth id of the author. */
  userId: string | null;
  /** The map they rated, or null when the arena has left the catalogue. */
  mapName: string | null;
  /** What they wrote, quoted back: a reader may have several opinions waiting,
   * and the map's name alone does not say which one this is. */
  review: string | null;
  approved: boolean;
  /** The map's page, which is both where a published opinion now shows and
   * where a rejected one is rewritten. Null when the slug could not be
   * resolved. */
  url?: string | null;
};

export async function notifyMapRatingAuthor(
  notice: MapRatingAuthorNotice,
): Promise<void> {
  const rewrite =
    "Your stars still count towards the average. Only the text came down, and you can write another one from the map page.";

  await sendAuthorNotice({
    userId: notice.userId,
    scope: "map-ratings",
    embed: {
      title: notice.approved
        ? "Your review is live"
        : "Your review was not published",
      // The map first, then their own words under it. The name is in the body
      // rather than the title because it is the one part that can be missing,
      // and a title assembled around a null reads as a bug.
      description: [
        notice.mapName ? `**${notice.mapName}**` : null,
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
