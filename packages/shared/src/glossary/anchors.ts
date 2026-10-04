/** The minimum a tooltip needs: what the term is called, one sentence, and
 * where to read the rest. */
export type GlossaryTooltipTerm = {
  slug: string;
  term: string;
  short: string;
};

/**
 * Every place the interface names something the glossary defines, in the form
 * the browser reads it.
 *
 * Only the anchored terms are here, and each appears once however many columns
 * it covers, so the whole thing is a few kilobytes: small enough to travel with
 * every page, which is what lets a tooltip appear instantly on a table the
 * reader has already scrolled to.
 */
export type GlossaryAnchorPayload = {
  terms: GlossaryTooltipTerm[];
  /** `tank_specs` column to the slug that defines it. */
  bySpecKey: Record<string, string>;
  /** Lowercased interface label to the slug that defines it. */
  byLabel: Record<string, string>;
};

/**
 * The same term, seen through a window, an average, or a mode: "30d WN8", "Avg
 * frags", "Avg WN8 · 30d", "Artillery Headquarters (Onslaught)". A table
 * qualifies its columns constantly, and every entry would otherwise have to
 * list one label per period and mode it is ever shown under.
 *
 * Only consulted after the whole label failed to match, so a term whose own
 * name starts with or ends in a qualifier ("Avg damage" is damage per game,
 * "Module HP (max / repaired)" is its own anchor) still resolves to itself.
 * Returns null when the label carries no qualifier, so a caller can skip the
 * second lookup.
 *
 * The trailing parenthesis is stripped WHOLE rather than matched against a list
 * of modes, because what sits inside it is the reader's language: English reads
 * "(Onslaught)" and French "(Offensive)", so a list would be an English one and
 * would leave every translated page on the fallback it is meant to be. Safe as
 * a last resort by construction, since a label whose parenthesis is part of its
 * name has already matched a line above.
 *
 * Here rather than in the browser's lookup because the coverage report reads it
 * too: a report that normalized labels differently from the page would call a
 * label undefined that a reader resolves on hover, which is the one thing it
 * exists to tell the truth about.
 */
export function unqualifyGlossaryLabel(label: string): string | null {
  const trimmed = label.trim();
  const stripped = trimmed
    .replace(/\s*[·(]\s*(?:24h|7d|30d|60d|90d)\s*\)?$/i, "")
    .replace(/^(?:avg|average|24h|7d|30d|last\s+(?:24h|7d|30d))\s+/i, "")
    .replace(/\s*\([^()]*\)$/, "")
    .trim();
  return stripped.length > 1 && stripped !== trimmed ? stripped : null;
}
