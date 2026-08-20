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
