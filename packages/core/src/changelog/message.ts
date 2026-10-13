import { APP_IDENTITY } from "@unicum.gg/shared";
import { packMessages } from "./parts";
import type { ChangelogDraft } from "./write";

/**
 * The Discord message itself. The shape is fixed here rather than left to the
 * model, so every update reads the same: a header, the entries marked by what
 * they are, and the link back to the site.
 *
 * It renders a list of messages rather than one, because the digest is weekly:
 * a day's entries fit in a message and a week's regularly do not. The splitting
 * itself lives in `./parts`, which the mod's release notes share, along with the
 * reasoning for splitting rather than trimming to fit.
 */

// Angle brackets suppress Discord's link preview, so the update ends on a line
// rather than on a card repeating what the message just said.
// "Website Update" rather than "Update": the mod announces into a channel of
// its own beside this one, so a bare "Update" no longer says which of the two
// shipped. The pair is named the same way on both sides for that reason.
const HEADER = ["> **Website Update** (@here)", "", "Changes:"];
const FOOTER = ["", `→ <${APP_IDENTITY.URL}/>`];

/** `+` added, `~` changed, `-` removed: the marker carries the category, so no
 * entry needs a heading above it.
 *
 * `-` is escaped because Discord reads a leading `- ` as a bullet: the removed
 * entries rendered as an indented list with a `•`, which broke the column the
 * other two markers line up in and made "removed" look like a different kind of
 * section rather than a third category. `+` and `~` start no list, so only this
 * one needs it, and `\-` renders as a plain `-` so the three read identically.
 */
const MARKER = { added: "+", changed: "~", removed: "\\-" };

function group(marker: string, entries: string[]): string[] {
  return entries.map((entry) => `${marker} ${entry}`);
}

/**
 * Renders the draft as the messages to post, in order. Empty for an empty
 * draft, which the caller answers before reaching here.
 */
export function renderChangelogMessage(draft: ChangelogDraft): string[] {
  const groups = [
    group(MARKER.added, draft.added),
    group(MARKER.changed, draft.changed),
    group(MARKER.removed, draft.removed),
  ].filter((g) => g.length > 0);

  // Blank line between groups, as the entries are only told apart by a marker.
  const lines = groups.flatMap((g, i) => (i === 0 ? g : ["", ...g]));

  return packMessages(lines, HEADER, FOOTER);
}
