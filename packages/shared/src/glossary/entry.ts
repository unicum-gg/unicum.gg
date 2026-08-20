import type { GlossaryCategory } from "./category";
import type { GlossaryLink } from "./links";

/** The shapes a paragraph of an entry can take. Deliberately small: a glossary
 * entry is prose plus the occasional list or formula, and anything richer would
 * be a guide, not a definition. */
export enum GlossaryBlockKind {
  Paragraph = "paragraph",
  List = "list",
  Formula = "formula",
}

export type GlossaryBlock =
  | { kind: GlossaryBlockKind.Paragraph; text: string }
  | { kind: GlossaryBlockKind.List; items: string[] }
  | { kind: GlossaryBlockKind.Formula; expression: string; note?: string };

/**
 * Where a term attaches to the interface, so its tooltip appears wherever the
 * site already names it. Declared on the term rather than in the components:
 * adding a definition to a stat is then a content change, not a JSX change, and
 * one entry covers every table that shows that stat.
 */
export type GlossaryAnchors = {
  /** `tank_specs` columns this term defines. The specifications table and the
   * catalogue columns read their rows by key, so this attaches without anyone
   * having to keep a label in sync. */
  specKeys?: string[];
  /** Exact column or row labels this term defines, for the tables whose
   * headings are plain strings. Matched whole and case-insensitively. */
  labels?: string[];
};

/**
 * One glossary term, in full. The body is what a reader gets on
 * `/glossary/<slug>`; `short` is the one sentence that has to work in three
 * places at once: the index card, the tooltip on the rest of the site, and the
 * search-result snippet.
 */
export type GlossaryEntry = {
  slug: string;
  term: string;
  /** Other spellings a reader may search or that the prose may use, so both the
   * site search and the cross-linking pass find the term. Never the plural of
   * the term itself, which is matched automatically. */
  aliases: string[];
  category: GlossaryCategory;
  /** One sentence, no more. It must define the term on its own, without the
   * body: a tooltip has no room for a second sentence. */
  short: string;
  body: GlossaryBlock[];
  /** Slugs of terms a reader of this one will want next. Cross-links in the
   * prose are found automatically, so this is for the ones the text never
   * happens to name. */
  related: string[];
  links?: GlossaryLink[];
  anchors?: GlossaryAnchors;
  /**
   * Set to false to keep the term out of the automatic cross-linking pass.
   *
   * For the handful of terms whose name is an ordinary English word used far
   * more often in its ordinary sense: linking "the weight of the evidence" to a
   * vehicle's tonnage is worse than not linking it at all. The term still has
   * its page, its place in the index and the search, and whatever entries name
   * it in `related`.
   */
  autoLink?: boolean;
};

/** An entry without its body: what the index, the tooltips and the search read.
 * The catalogue is a few hundred entries, so the list endpoint serves this and
 * the detail endpoint serves the whole thing. */
export type GlossarySummary = Pick<
  GlossaryEntry,
  "slug" | "term" | "aliases" | "category" | "short"
>;

export function toGlossarySummary(entry: GlossaryEntry): GlossarySummary {
  const { slug, term, aliases, category, short } = entry;
  return { slug, term, aliases, category, short };
}

/**
 * The short form a term is also known by, when it has one: "MoE" for Marks of
 * Excellence, "SPG" for Artillery.
 *
 * Shown next to the name in the index, because a reader scanning for "DPG"
 * scans for those three letters and not for "Damage per game": an alias that
 * only the search can reach is an alias half the readers never find. Detected
 * rather than declared, so no entry carries a field restating what its own
 * aliases already say: a single word of two to six characters with at least two
 * capitals in it is an initialism, and nothing else is.
 */
export function glossaryAcronym(entry: {
  aliases: readonly string[];
  term: string;
}): string | null {
  if (isAcronym(entry.term)) return null;
  return entry.aliases.find(isAcronym) ?? null;
}

function isAcronym(alias: string): boolean {
  if (alias.includes(" ") || alias.length < 2 || alias.length > 6) return false;
  return (alias.match(/[A-Z]/g) ?? []).length >= 2;
}

/** The index letter a term files under. Anything that does not start with a
 * letter (`3D style`) files under `#`, the way a printed glossary does. */
export function glossaryLetter(term: string): string {
  const first = term.trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}
