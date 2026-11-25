import type { APIEmbedField } from "discord-api-types/v10";
import { clamp, DISCORD_LIMITS } from "@unicum.gg/core/discord/announce";
import { packMessages } from "./parts";

/**
 * The card both changelogs post: a few entries per group on the embed, and the
 * whole list in the thread under it.
 *
 * Shared because the site's digest and the mod's releases are the same shape
 * once their source is read (a handful of named groups of one-line entries),
 * and the two cards must cut the same way: a reader who learns that "+4 more"
 * means "in the thread" on one channel should find it true on the other.
 */

export type EntryGroup = {
  /** The heading, as the card prints it ("New", "Fixed"). */
  title: string;
  emoji: string;
  entries: string[];
  /** How many entries the card shows before pointing at the thread. */
  show: number;
};

/** The emoji a group heading gets, read off its title so the mod's own
 * headings (which its author writes) are matched as well as ours. */
export function groupEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.startsWith("add") || t === "new") return "✨";
  if (t.startsWith("improv")) return "🛠️";
  if (t.startsWith("fix")) return "🐞";
  if (t.startsWith("remov")) return "🗑️";
  if (t.startsWith("chang")) return "🔁";
  return "•";
}

/** Whether any group has entries the card leaves to the thread. */
export function hasHiddenEntries(groups: EntryGroup[]): boolean {
  return groups.some((g) => g.entries.length > g.show);
}

/**
 * One embed field per non-empty group: its first entries, then how many more
 * the thread holds. Entries are dropped from the end rather than cut, so a
 * field near Discord's 1024 characters shows fewer whole lines instead of a
 * sentence stopped half way.
 */
export function groupFields(groups: EntryGroup[]): APIEmbedField[] {
  return groups
    .filter((g) => g.entries.length > 0)
    .map((g) => {
      const shown: string[] = [];
      const more = (n: number) => (n > 0 ? `+${n} more in the thread` : "");
      for (const entry of g.entries.slice(0, g.show)) {
        const line = `• ${clamp(entry, 300)}`;
        const tail = more(g.entries.length - shown.length - 1);
        const next = [...shown, line, tail].filter(Boolean).join("\n");
        if (next.length > DISCORD_LIMITS.fieldValue) break;
        shown.push(line);
      }
      const hidden = g.entries.length - shown.length;
      return {
        name: `${g.emoji} ${g.title} · ${g.entries.length}`,
        value: [...shown, more(hidden)].filter(Boolean).join("\n"),
      };
    });
}

/** Every entry of every group, as the thread's messages. */
export function groupThread(groups: EntryGroup[]): string[] {
  const lines = groups
    .filter((g) => g.entries.length > 0)
    .flatMap((g, i) => [
      ...(i === 0 ? [] : [""]),
      `**${g.emoji} ${g.title}**`,
      ...g.entries.map((e) => `• ${e}`),
    ]);
  return packMessages(lines, [], []);
}
