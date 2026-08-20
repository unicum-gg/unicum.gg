import { GLOSSARY_ENTRIES } from "./entries.generated";
import {
  buildGlossaryMatcher,
  GlossaryBlockKind,
  glossaryLetter,
  linkifyGlossary,
  toGlossarySummary,
  type GlossaryCategory,
  type GlossaryEntry,
  type GlossaryAnchorPayload,
  type GlossaryMatcher,
  type GlossaryRenderedBlock,
  type GlossarySummary,
  type GlossaryTermDetail,
} from "@unicum.gg/shared";

const collator = new Intl.Collator("en", { sensitivity: "base" });

/**
 * The glossary catalogue: every term the site defines.
 *
 * The source is markdown with frontmatter, one file per term under
 * `content/glossary/<category>/<slug>.md`, compiled into `entries.generated.ts`
 * by `scripts/generate-glossary.ts` on predev/prebuild/postinstall. It is
 * content, not data, so it lives in the repository rather than in the database:
 * a definition is reviewed in a pull request like any other change, it ships
 * with the commit that introduces the feature it describes, and it costs no
 * query to read. Small enough (a few hundred entries) to hold in memory and
 * index once.
 */
const ENTRIES: GlossaryEntry[] = [...GLOSSARY_ENTRIES].sort((a, b) =>
  collator.compare(a.term, b.term),
);

const bySlug = new Map(ENTRIES.map((entry) => [entry.slug, entry]));

/**
 * Cross-checks the catalogue holds together: no two entries claim the same
 * slug, and no entry points at a term that does not exist. Both are silent
 * failures in production (a duplicate shadows an entry, a stale `related` slug
 * renders a dead link), so they throw here, where the author sees them.
 */
function assertCatalogueIntegrity(): void {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of ENTRIES) {
    if (seen.has(entry.slug)) problems.push(`duplicate slug: ${entry.slug}`);
    seen.add(entry.slug);
    for (const slug of entry.related) {
      if (!bySlug.has(slug)) {
        problems.push(`${entry.slug} relates to an unknown term: ${slug}`);
      }
    }
  }
  // Every problem at once: writing entries means fixing these in batches, and a
  // check that stops at the first one turns that into a dozen runs.
  if (problems.length) {
    throw new Error(`[glossary]\n  ${problems.join("\n  ")}`);
  }
}

if (process.env.NODE_ENV !== "production") assertCatalogueIntegrity();

/** Every term, alphabetically, without its body. What the index page, the site
 * search and the tooltips read. */
export function listGlossary(): GlossarySummary[] {
  return ENTRIES.map(toGlossarySummary);
}

/** One term in full, or null when the slug is unknown. */
export function getGlossaryTerm(slug: string): GlossaryEntry | null {
  return bySlug.get(slug) ?? null;
}

export function listGlossarySlugs(): string[] {
  return ENTRIES.map((entry) => entry.slug);
}

export function listGlossaryByCategory(
  category: GlossaryCategory,
): GlossarySummary[] {
  return ENTRIES.filter((entry) => entry.category === category).map(
    toGlossarySummary,
  );
}

/** The terms of one entry's `related` list, in catalogue order, skipping any
 * that no longer exist (they throw in development, so this only ever drops one
 * in production). */
export function listRelatedTerms(entry: GlossaryEntry): GlossarySummary[] {
  return entry.related
    .map((slug) => bySlug.get(slug))
    .filter((related) => related !== undefined)
    .map(toGlossarySummary);
}

/** How many terms file under each index letter, so the index page can render
 * the alphabet with the empty letters disabled. */
export function glossaryLetterCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of ENTRIES) {
    const letter = glossaryLetter(entry.term);
    counts[letter] = (counts[letter] ?? 0) + 1;
  }
  return counts;
}

let matcher: GlossaryMatcher | null = null;

/** The cross-linking pass over the whole catalogue, built once. Terms that opted
 * out are absent from it, so their ordinary-English name is left alone. */
export function getGlossaryMatcher(): GlossaryMatcher {
  matcher ??= buildGlossaryMatcher(
    ENTRIES.filter((entry) => entry.autoLink !== false).map(toGlossarySummary),
  );
  return matcher;
}

export type GlossaryAnchorIndex = {
  /** `tank_specs` column to the slug that defines it. */
  bySpecKey: Map<string, string>;
  /** Lowercased UI label to the slug that defines it. */
  byLabel: Map<string, string>;
};

let anchors: GlossaryAnchorIndex | null = null;

/**
 * Where each term attaches to the interface. Built from the entries themselves,
 * so a stat gets its tooltip the moment someone writes its definition, without
 * a component having to be touched.
 */
export function getGlossaryAnchors(): GlossaryAnchorIndex {
  if (anchors) return anchors;
  const bySpecKey = new Map<string, string>();
  const byLabel = new Map<string, string>();
  for (const entry of ENTRIES) {
    for (const key of entry.anchors?.specKeys ?? []) {
      if (!bySpecKey.has(key)) bySpecKey.set(key, entry.slug);
    }
    for (const label of entry.anchors?.labels ?? []) {
      const key = label.toLowerCase();
      if (!byLabel.has(key)) byLabel.set(key, entry.slug);
    }
  }
  anchors = { bySpecKey, byLabel };
  return anchors;
}

/**
 * One term, ready to render: its body run through the cross-linking pass and
 * its related terms resolved.
 *
 * The linking happens here rather than in the page because it needs the whole
 * catalogue, and shipping a few hundred terms to the browser to underline a
 * dozen words would cost more than the page itself. The `seen` set spans the
 * entire body, so each term is linked on its first mention and read as plain
 * text after that, and it is seeded with this entry's own slug so a definition
 * never links to itself.
 */
export function renderGlossaryTerm(slug: string): GlossaryTermDetail | null {
  const entry = getGlossaryTerm(slug);
  if (!entry) return null;
  const matcher = getGlossaryMatcher();
  const seen = new Set<string>([entry.slug]);
  const body = entry.body.map((block): GlossaryRenderedBlock => {
    switch (block.kind) {
      case GlossaryBlockKind.Paragraph:
        return { kind: block.kind, segments: linkifyGlossary(block.text, matcher, seen) };
      case GlossaryBlockKind.List:
        return {
          kind: block.kind,
          items: block.items.map((item) => linkifyGlossary(item, matcher, seen)),
        };
      case GlossaryBlockKind.Formula:
        return block;
    }
  });
  return {
    slug: entry.slug,
    term: entry.term,
    aliases: entry.aliases,
    category: entry.category,
    short: entry.short,
    body,
    related: listRelatedTerms(entry),
    links: entry.links ?? [],
  };
}

let anchorPayload: GlossaryAnchorPayload | null = null;

/**
 * The anchors as the browser consumes them: the anchored terms once each, plus
 * the two lookups pointing at them.
 *
 * Built from the same declarations the coverage report reads, so a stat gets
 * its tooltip the moment someone writes its definition. Terms with no anchor
 * are absent: they are reached from the glossary itself, not from a table.
 */
export function getGlossaryAnchorPayload(): GlossaryAnchorPayload {
  if (anchorPayload) return anchorPayload;
  const { bySpecKey, byLabel } = getGlossaryAnchors();
  const slugs = new Set([...bySpecKey.values(), ...byLabel.values()]);
  anchorPayload = {
    terms: ENTRIES.filter((entry) => slugs.has(entry.slug)).map((entry) => ({
      slug: entry.slug,
      term: entry.term,
      short: entry.short,
    })),
    bySpecKey: Object.fromEntries(bySpecKey),
    byLabel: Object.fromEntries(byLabel),
  };
  return anchorPayload;
}
