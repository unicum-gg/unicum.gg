import type { GlossaryBlockKind, GlossarySummary } from "./entry";
import type { GlossarySegment } from "./linkify";
import type { GlossaryCategory } from "./category";
import type { GlossaryLink } from "./links";

/**
 * A block of an entry after the cross-linking pass has run over it: the same
 * shape as the authored block, with its prose split into linked and unlinked
 * runs. The linking is done once on the server rather than in the page, so a
 * reader's browser never has to hold the catalogue to render one definition.
 */
export type GlossaryRenderedBlock =
  | { kind: GlossaryBlockKind.Paragraph; segments: GlossarySegment[] }
  | { kind: GlossaryBlockKind.List; items: GlossarySegment[][] }
  | { kind: GlossaryBlockKind.Formula; expression: string; note?: string };

/** One term as a reader receives it: the entry, its body linked, and its
 * related terms resolved to something renderable. */
export type GlossaryTermDetail = {
  slug: string;
  term: string;
  aliases: string[];
  category: GlossaryCategory;
  short: string;
  body: GlossaryRenderedBlock[];
  related: GlossarySummary[];
  links: GlossaryLink[];
};
