import { APP_IDENTITY } from "@unicum.gg/shared";
import { packMessages } from "../parts";
import type { ModRelease } from "./releases";

/**
 * The mod's Discord message.
 *
 * It keeps the release notes' own structure instead of folding them onto the
 * site digest's three markers (`+` added, `~` changed, `-` removed). The mod
 * writes four headings, Added, Improved, Changed and Fixed, and the difference
 * between the last three is the whole information a reader is after: "the
 * contacts list no longer draws flags over the name" and "the mod no longer
 * lists a folder nine times a second" are a fix and a saving, and a single `~`
 * on both says neither. The site's markers exist because a model is asked for
 * three buckets; here the author already sorted them.
 *
 * Only the download link is ours to add, and it points at the mod page rather
 * than at the GitHub release: a release is installable from GitHub the moment
 * it is cut and reaches the hub only once Wargaming has reviewed it, which took
 * six days for 0.1.1. The mod page is the one place that names both versions
 * and both ways to get it, so it stays right during that gap, where a link to
 * either one alone is briefly misleading.
 */

const FOOTER = ["", `→ <${APP_IDENTITY.URL}/mod>`];

function header(release: ModRelease): string[] {
  return [`> **Mod Update** · **${release.version}** (@here)`, ""];
}

/**
 * The notes as Discord lines.
 *
 * Markdown headings become bold rather than staying headings. Discord does
 * render `###` as one, but at a size built for a section of chat: on notes that
 * carry four of them in fifteen lines it drowns out the entries underneath,
 * which are the part being read. Bold matches the digest's density beside it.
 *
 * A leading `## 0.4.1` is dropped when present. `release.yml` excludes that
 * line when it lifts the section out of the CHANGELOG, so it only appears on
 * notes somebody wrote by hand in the GitHub UI, where it would print the
 * version a second time under the header that already names it.
 */
function toLines(release: ModRelease): string[] {
  const lines: string[] = [];
  // A section's entries follow its heading with nothing between them, so the
  // heading reads as belonging to them. The source puts a blank line there and
  // it is dropped: a heading with a gap on both sides floats between two
  // groups instead of opening one. The separation is the blank ABOVE it.
  let justHeading = false;

  for (const raw of release.notes.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);

    if (heading) {
      const title = heading[1].trim();
      // The version heading, in any of the shapes a CHANGELOG writes it
      // (`## 0.4.1`, `## [0.4.1]`, `## v0.4.1`).
      if (title.replace(/[[\]v]/g, "") === release.version) continue;
      // One blank line above a section, and only one: the source already ends
      // the previous section with a blank, so pushing a separator on top of it
      // is what printed two.
      if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
      lines.push(`**${title}**`);
      justHeading = true;
      continue;
    }

    if (line === "") {
      // Collapse runs of blank lines, and drop the one under a heading.
      if (!justHeading && lines.length > 0 && lines.at(-1) !== "") {
        lines.push("");
      }
      continue;
    }

    lines.push(line);
    justHeading = false;
  }

  while (lines.at(-1) === "") lines.pop();
  return lines;
}

/**
 * Renders a release as the messages to post, in order.
 *
 * A list, because the limit is Discord's and the notes are not ours to shorten:
 * 0.4.0's ran to about 1,500 characters and a release that adds a feature with
 * its own paragraph will pass 2,000. The packing is `../parts`, shared with the
 * site's digest, so neither can learn to trim entries away on its own.
 *
 * Empty for a release with no notes, which the caller answers before here: a
 * header and a link with nothing between them announces nothing.
 */
export function renderModChangelogMessage(release: ModRelease): string[] {
  const lines = toLines(release);
  if (lines.length === 0) return [];
  return packMessages(lines, header(release), FOOTER);
}
