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
  hasHiddenEntries,
} from "../card";
import { packMessages } from "../parts";
import type { ModRelease } from "./releases";

/**
 * The mod's Discord announcement.
 *
 * It keeps the release notes' own structure instead of folding them onto the
 * site digest's groups. The mod writes four headings, Added, Improved, Changed
 * and Fixed, and the difference between the last three is the whole
 * information a reader is after: "the contacts list no longer draws flags over
 * the name" and "the mod no longer lists a folder nine times a second" are a
 * fix and a saving, and one marker on both says neither. The site's groups
 * exist because a model is asked for them; here the author already sorted.
 *
 * The card shows the first entries of each section and the thread carries the
 * notes exactly as written: 0.10.0 ran to about seventy lines, which as plain
 * text was two messages a reader scrolled past.
 *
 * The download button points at the hub rather than at the GitHub release, and
 * the release sits beside it: a release is installable from GitHub the moment
 * it is cut and reaches the hub only once Wargaming has reviewed it, which took
 * six days for 0.1.1. The footer says so, since a reader clicking the hub on
 * release day would otherwise find the previous version and think the card
 * wrong.
 */

/** Entries the card shows per section. The first section is what the release
 * is about (Added, nearly always), so it gets the most room. */
const SHOW_FIRST = 4;
const SHOW_OTHERS = 3;

/** A version heading, in any of the shapes a CHANGELOG writes it
 * (`## 0.4.1`, `## [0.4.1]`, `## v0.4.1`). */
function isVersionHeading(title: string, release: ModRelease): boolean {
  return title.replace(/[[\]v]/g, "") === release.version;
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
      if (isVersionHeading(title, release)) continue;
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
 * The notes read as sections: the text above the first heading (an intro, when
 * the author wrote one) and each heading's entries.
 */
export function readSections(release: ModRelease): {
  intro: string;
  sections: { title: string; entries: string[] }[];
} {
  const intro: string[] = [];
  const sections: { title: string; entries: string[] }[] = [];
  for (const raw of release.notes.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      const title = heading[1].trim();
      if (!isVersionHeading(title, release)) sections.push({ title, entries: [] });
      continue;
    }
    const entry = line.replace(/^[-*]\s+/, "");
    if (sections.length === 0) intro.push(entry);
    else sections.at(-1)!.entries.push(entry);
  }
  return {
    intro: intro.join(" "),
    sections: sections.filter((s) => s.entries.length > 0),
  };
}

/**
 * A release as one announcement, or null for a release with no notes, which
 * the caller answers before here: a card with nothing on it announces nothing.
 */
export function renderModAnnouncement(release: ModRelease): Announcement | null {
  const lines = toLines(release);
  if (lines.length === 0) return null;

  const { intro, sections } = readSections(release);
  const groups: EntryGroup[] = sections.map((section, i) => ({
    title: section.title,
    emoji: groupEmoji(section.title),
    entries: section.entries,
    show: i === 0 ? SHOW_FIRST : SHOW_OTHERS,
  }));
  // Notes with no headings at all are a paragraph or a bare list: the card
  // carries them as its description and the thread is not needed.
  const description =
    groups.length === 0 ? lines.join("\n") : intro || undefined;

  return {
    pingRoleId: env.DISCORD_MOD_UPDATES_ROLE_ID ?? null,
    embeds: [
      {
        color: AnnouncementColor.Mod,
        author: { name: `${APP_IDENTITY.NAME} mod · release` },
        title: `Version ${release.version}`,
        url: release.url,
        description: description
          ? clamp(description, DISCORD_LIMITS.description)
          : undefined,
        fields: groupFields(groups),
        footer: {
          text: "On GitHub now, on WGMods once Wargaming has reviewed it",
        },
        timestamp: release.publishedAt.toISOString(),
      },
    ],
    buttons: [
      { label: "Download (WGMods)", url: APP_IDENTITY.MOD_HUB_URL },
      { label: "GitHub release", url: release.url },
      { label: "Mod page", url: `${APP_IDENTITY.URL}/mod` },
    ],
    thread: hasHiddenEntries(groups)
      ? {
          name: `${release.version} release notes`,
          messages: packMessages(lines, [], []),
        }
      : undefined,
  };
}
