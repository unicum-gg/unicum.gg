import { APP_IDENTITY } from "@unicum.gg/shared";
import type { ChangelogDraft } from "./write";

/**
 * The Discord message itself. The shape is fixed here rather than left to the
 * model, so every update reads the same: a header, the entries marked by what
 * they are, and the link back to the site.
 *
 * It renders a list of messages rather than one, because the digest is weekly.
 * A day's entries fit in a message and a week's regularly do not, and the
 * earlier answer to that was to drop entries off the end until the rest fit,
 * which on a week-long batch stops being a safety net and becomes the normal
 * outcome: the end is the `removed` group every time, since it is rendered
 * last. Splitting keeps every entry and still reads as one update, as only the
 * first part carries the header and only the last carries the link.
 */

/** Discord rejects a message over 2000 characters. */
const MAX_LENGTH = 2000;

// Angle brackets suppress Discord's link preview, so the update ends on a line
// rather than on a card repeating what the message just said.
const HEADER = ["> **Update** (@here)", "", "Changes:"];
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

/** What these lines will measure once joined by newlines. */
function joinLength(lines: string[]): number {
  const chars = lines.reduce((total, line) => total + line.length, 0);
  return chars + Math.max(lines.length - 1, 0);
}

/** Room left for entries in the tightest part: the first one, which carries the
 * header, minus the footer, whose room is reserved everywhere since a part only
 * learns it is the last once the packing is done. */
const BUDGET = MAX_LENGTH - joinLength(HEADER) - joinLength(FOOTER) - 2;

/** An entry longer than a whole message has never happened, but a model that
 * answered with a paragraph would otherwise build a part Discord rejects, which
 * is the failure this file exists to prevent. */
function clamp(line: string): string {
  if (line.length <= BUDGET) return line;
  return `${line.slice(0, BUDGET - 1).trimEnd()}…`;
}

/** The entry lines packed into parts, none of which will exceed the limit once
 * its header and footer are added back. */
function pack(lines: string[]): string[][] {
  const parts: string[][] = [];
  let body: string[] = [];

  const flush = (): void => {
    // A part can end on the blank line that separated two groups.
    while (body.at(-1) === "") body.pop();
    if (body.length > 0) parts.push(body);
    body = [];
  };

  for (const line of lines) {
    const head = parts.length === 0 ? HEADER : [];
    if (body.length > 0 && joinLength([...head, ...body, line]) > BUDGET) {
      flush();
      // A part must not open on a group's blank separator.
      if (line === "") continue;
    }
    body.push(line);
  }
  flush();
  return parts;
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
  const lines = groups.flatMap((g, i) => (i === 0 ? g : ["", ...g])).map(clamp);
  const parts = pack(lines);

  return parts.map((body, i) =>
    [
      ...(i === 0 ? HEADER : []),
      ...body,
      ...(i === parts.length - 1 ? FOOTER : []),
    ].join("\n"),
  );
}
