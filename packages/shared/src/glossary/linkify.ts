import type { GlossarySummary } from "./entry";

/** A run of body text, carrying the slug it links to when the pass matched a
 * term there. A segment with no slug is plain text. */
export type GlossarySegment = { text: string; slug?: string };

export type GlossaryMatcher = {
  pattern: RegExp;
  /** Lowercased surface form (term or alias) to the slug it belongs to. */
  bySurface: Map<string, string>;
};

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build the cross-linking pass over a whole catalogue, once.
 *
 * Every entry names other terms in passing, and hand-linking them would mean
 * writing the same link a hundred times and re-checking it whenever a slug
 * moves. So the prose stays plain text and this finds the terms in it: the
 * internal linking is a property of the catalogue, not something a writer
 * maintains. Surfaces are matched longest-first so "view range" wins over
 * "range", and a trailing plural is accepted so "shells" still finds "shell".
 */
export function buildGlossaryMatcher(
  entries: readonly GlossarySummary[],
): GlossaryMatcher {
  const bySurface = new Map<string, string>();
  for (const entry of entries) {
    for (const surface of [entry.term, ...entry.aliases]) {
      const key = surface.toLowerCase();
      // First writer wins, so an alias never steals another entry's own term.
      if (!bySurface.has(key)) bySurface.set(key, entry.slug);
    }
  }
  const surfaces = [...bySurface.keys()].sort((a, b) => b.length - a.length);
  const pattern = surfaces.length
    ? new RegExp(`(?<![\\w-])(${surfaces.map(escape).join("|")})(s?)(?![\\w-])`, "gi")
    : // Matches nothing, so an empty catalogue degrades to plain text.
      /(?!)/g;
  return { pattern, bySurface };
}

/**
 * Split `text` into linked and unlinked segments.
 *
 * `seen` is the caller's, not ours: a term is linked on its first mention in a
 * page and read as plain text afterwards, which is the convention a glossary
 * reader expects and keeps a dense entry from turning into a wall of links. The
 * caller passes the same set across every block of the body, and seeds it with
 * the page's own slug so an entry never links to itself.
 */
export function linkifyGlossary(
  text: string,
  matcher: GlossaryMatcher,
  seen: Set<string> = new Set(),
): GlossarySegment[] {
  const segments: GlossarySegment[] = [];
  let last = 0;
  // `matchAll` iterates over a copy of the pattern, so the shared matcher's
  // cursor is never carried between calls.
  for (const match of text.matchAll(matcher.pattern)) {
    const [whole, surface] = match;
    const at = match.index;
    // The whole match first: a surface that happens to end in "s" is a term of
    // its own, not the plural of a shorter one.
    const slug =
      matcher.bySurface.get(whole.toLowerCase()) ??
      matcher.bySurface.get(surface.toLowerCase());
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    if (at > last) segments.push({ text: text.slice(last, at) });
    segments.push({ text: whole, slug });
    last = at + whole.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}
