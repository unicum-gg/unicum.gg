import { APP_IDENTITY, env } from "@unicum.gg/shared";
import {
  AnnouncementColor,
  clamp,
  DISCORD_LIMITS,
  type Announcement,
} from "@unicum.gg/core/discord/announce";
import {
  type EntryGroup,
  groupEmoji,
  groupFields,
  groupThread,
  hasHiddenEntries,
} from "./card";
import type { ChangelogDraft } from "./write";

/**
 * The site's weekly digest as a Discord announcement. The shape is fixed here
 * rather than left to the model, so every week reads the same: the model's
 * headline, then each group's most significant entries, then the whole list in
 * a thread under the card. The model only writes sentences and orders them.
 *
 * It used to be plain text, `+` / `~` / `-` markers on every line, which ran to
 * two messages of thirty lines on a busy week with nothing standing out. The
 * card keeps the channel to one post a week and leaves the rest a click away.
 */

/** How many entries each group shows on the card. New things lead the update,
 * so they get the most room. */
const SHOW = { added: 5, improved: 3, fixed: 3, removed: 3 };

function groups(draft: ChangelogDraft): EntryGroup[] {
  return [
    { title: "New", entries: draft.added, show: SHOW.added },
    { title: "Improved", entries: draft.improved, show: SHOW.improved },
    { title: "Fixed", entries: draft.fixed, show: SHOW.fixed },
    { title: "Removed", entries: draft.removed, show: SHOW.removed },
  ].map((g) => ({ ...g, emoji: groupEmoji(g.title) }));
}

/** The digest as one announcement. The caller answers an empty draft first. */
export function renderChangelogAnnouncement(
  draft: ChangelogDraft,
): Announcement {
  const all = groups(draft);
  const total = all.reduce((sum, g) => sum + g.entries.length, 0);
  const hidden = hasHiddenEntries(all);

  return {
    pingRoleId: env.DISCORD_WEBSITE_UPDATES_ROLE_ID ?? null,
    embeds: [
      {
        color: AnnouncementColor.Website,
        author: { name: `${APP_IDENTITY.NAME} · Website update` },
        title: "What's new this week",
        url: `${APP_IDENTITY.URL}/`,
        description: draft.headline
          ? clamp(draft.headline, DISCORD_LIMITS.description)
          : undefined,
        fields: groupFields(all),
        footer: {
          text: `${total} ${total === 1 ? "change" : "changes"}${hidden ? " · the full list is in the thread" : ""}`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
    buttons: [{ label: "Open unicum.gg", url: `${APP_IDENTITY.URL}/` }],
    // Only when the card left something out: a thread repeating the card word
    // for word is a second copy for nobody.
    thread: hidden
      ? { name: "Full changelog", messages: groupThread(all) }
      : undefined,
  };
}
