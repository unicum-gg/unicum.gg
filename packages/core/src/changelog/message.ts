import { APP_IDENTITY } from "@unicum.gg/shared";
import type { ChangelogDraft } from "./write";

/**
 * The Discord message itself. The shape is fixed here rather than left to the
 * model, so every update reads the same: a header, the entries marked by what
 * they are, and the link back to the site.
 */

/** Discord rejects a message over 2000 characters. */
const MAX_LENGTH = 2000;

const HEADER = "> **Update** (@here)";
// Angle brackets suppress Discord's link preview, so the update ends on a line
// rather than on a card repeating what the message just said.
const FOOTER = `→ <${APP_IDENTITY.URL}/>`;

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

function assemble(lines: string[], dropped: number): string {
  // A slice can end on the blank line that separated two groups.
  const body = [...lines];
  while (body.at(-1) === "") body.pop();
  if (dropped > 0) body.push(`… and ${dropped} more`);
  return [HEADER, "", "Changes:", ...body, "", FOOTER].join("\n");
}

/**
 * Renders the draft, trimming entries off the end until Discord accepts it. A
 * digest that long has never happened, but a silent 400 on the one message the
 * feature exists to send would be the worst way to find out.
 */
export function renderChangelogMessage(draft: ChangelogDraft): string {
  const groups = [
    group(MARKER.added, draft.added),
    group(MARKER.changed, draft.changed),
    group(MARKER.removed, draft.removed),
  ].filter((g) => g.length > 0);

  // Blank line between groups, as the entries are only told apart by a marker.
  const lines = groups.flatMap((g, i) => (i === 0 ? g : ["", ...g]));
  const entryCount = lines.filter(Boolean).length;

  let kept = lines.length;
  let message = assemble(lines, 0);
  while (message.length > MAX_LENGTH && kept > 0) {
    kept -= 1;
    const keptEntries = lines.slice(0, kept).filter(Boolean).length;
    message = assemble(lines.slice(0, kept), entryCount - keptEntries);
  }
  return message;
}
