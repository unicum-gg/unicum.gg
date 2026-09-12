import { GLOSSARY_LOCALES, loadGlossaryEntries } from "./generated";
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

/**
 * One language's catalogue, built once and kept.
 *
 * The entries are markdown compiled into a module a language (see
 * `scripts/generate-glossary`), imported on demand: the English alone is 200 KB
 * of generated TypeScript, so a reader who asked for one page has no business
 * loading thirty-five of them. A language with no tree of its own resolves to
 * the English, which is what every locale read before any of this existed.
 */
type Catalogue = {
  entries: GlossaryEntry[];
  bySlug: Map<string, GlossaryEntry>;
  matcher: GlossaryMatcher;
};

const catalogues = new Map<string, Promise<Catalogue>>();

/**
 * Which module a locale actually reads. Anything untranslated is English.
 *
 * Exported because a response has to say which language it is in, and the
 * fallback happens here: echoing the request would tell a Swedish caller they
 * got Swedish when the body is English.
 */
export const glossaryLocale = (locale: string | undefined): string =>
  locale && GLOSSARY_LOCALES.has(locale) ? locale : "en";

const resolve = glossaryLocale;

async function build(locale: string): Promise<Catalogue> {
  // English underneath, entry by entry. A language is translated over several
  // runs (the tree is 210 entries and the budget is finite), so a partial one
  // must read as "these are translated and the rest are not" rather than as a
  // glossary that has lost the terms nobody has reached yet: without this, a
  // half-written locale answers 404 on every entry it is missing and its index
  // silently lists a subset.
  const english = await loadGlossaryEntries("en");
  const own =
    locale === "en" ? [] : await loadGlossaryEntries(locale);
  const bySlug = new Map(english.map((entry) => [entry.slug, entry]));
  for (const entry of own) bySlug.set(entry.slug, entry);

  // Sorted in the reader's own alphabet: the index page is an A-to-Z, and
  // "Épaisseur" files under E for a French reader.
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const entries = [...bySlug.values()].sort((a, b) =>
    collator.compare(a.term, b.term),
  );
  if (process.env.NODE_ENV !== "production") {
    assertCatalogueIntegrity(entries, locale);
  }
  return {
    entries,
    bySlug,
    // Terms that opted out are absent, so their ordinary-English name is left
    // alone.
    matcher: buildGlossaryMatcher(
      entries.filter((entry) => entry.autoLink !== false).map(toGlossarySummary),
    ),
  };
}

function catalogue(locale?: string): Promise<Catalogue> {
  const key = resolve(locale);
  let pending = catalogues.get(key);
  if (!pending) {
    pending = build(key);
    catalogues.set(key, pending);
  }
  return pending;
}


/**
 * Cross-checks the catalogue holds together: no two entries claim the same
 * slug, and no entry points at a term that does not exist. Both are silent
 * failures in production (a duplicate shadows an entry, a stale `related` slug
 * renders a dead link), so they throw here, where the author sees them.
 */
function assertCatalogueIntegrity(entries: GlossaryEntry[], locale: string): void {
  const problems: string[] = [];
  const seen = new Set<string>();
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  for (const entry of entries) {
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
    throw new Error(`[glossary:${locale}]\n  ${problems.join("\n  ")}`);
  }
}


/** Every term, alphabetically, without its body. What the index page, the site
 * search and the tooltips read. */
export async function listGlossary(locale?: string): Promise<GlossarySummary[]> {
  return (await catalogue(locale)).entries.map(toGlossarySummary);
}

/** One term in full, or null when the slug is unknown. */
export async function getGlossaryTerm(
  slug: string,
  locale?: string,
): Promise<GlossaryEntry | null> {
  return (await catalogue(locale)).bySlug.get(slug) ?? null;
}

/** The slugs, which are the same in every language: a slug is the filename and
 * a URL must not move when a page is translated. */
export async function listGlossarySlugs(): Promise<string[]> {
  return (await catalogue()).entries.map((entry) => entry.slug);
}

export async function listGlossaryByCategory(
  category: GlossaryCategory,
  locale?: string,
): Promise<GlossarySummary[]> {
  return (await catalogue(locale)).entries
    .filter((entry) => entry.category === category)
    .map(toGlossarySummary);
}

/** The terms of one entry's `related` list, in catalogue order, skipping any
 * that no longer exist (they throw in development, so this only ever drops one
 * in production). */
function listRelatedTerms(
  entry: GlossaryEntry,
  bySlug: Map<string, GlossaryEntry>,
): GlossarySummary[] {
  return entry.related
    .map((slug) => bySlug.get(slug))
    .filter((related) => related !== undefined)
    .map(toGlossarySummary);
}

/** How many terms file under each index letter, so the index page can render
 * the alphabet with the empty letters disabled. */
export async function glossaryLetterCounts(
  locale?: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const entry of (await catalogue(locale)).entries) {
    const letter = glossaryLetter(entry.term);
    counts[letter] = (counts[letter] ?? 0) + 1;
  }
  return counts;
}


export type GlossaryAnchorIndex = {
  /** `tank_specs` column to the slug that defines it. */
  bySpecKey: Map<string, string>;
  /** Lowercased UI label to the slug that defines it. */
  byLabel: Map<string, string>;
};

const anchorIndexes = new Map<string, GlossaryAnchorIndex>();

/**
 * Where each term attaches to the interface. Built from the entries themselves,
 * so a stat gets its tooltip the moment someone writes its definition, without
 * a component having to be touched.
 */
export async function getGlossaryAnchors(
  locale?: string,
): Promise<GlossaryAnchorIndex> {
  const key = resolve(locale);
  const cached = anchorIndexes.get(key);
  if (cached) return cached;
  const bySpecKey = new Map<string, string>();
  const byLabel = new Map<string, string>();
  for (const entry of (await catalogue(key)).entries) {
    for (const key of entry.anchors?.specKeys ?? []) {
      if (!bySpecKey.has(key)) bySpecKey.set(key, entry.slug);
    }
    for (const label of entry.anchors?.labels ?? []) {
      const key = label.toLowerCase();
      if (!byLabel.has(key)) byLabel.set(key, entry.slug);
    }
  }
  const index = { bySpecKey, byLabel };
  anchorIndexes.set(key, index);
  return index;
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
export async function renderGlossaryTerm(
  slug: string,
  locale?: string,
): Promise<GlossaryTermDetail | null> {
  const { bySlug, matcher } = await catalogue(locale);
  const entry = bySlug.get(slug);
  if (!entry) return null;
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
    related: listRelatedTerms(entry, bySlug),
    links: entry.links ?? [],
  };
}

const anchorPayloads = new Map<string, GlossaryAnchorPayload>();

/**
 * The anchors as the browser consumes them: the anchored terms once each, plus
 * the two lookups pointing at them.
 *
 * Built from the same declarations the coverage report reads, so a stat gets
 * its tooltip the moment someone writes its definition. Terms with no anchor
 * are absent: they are reached from the glossary itself, not from a table.
 */
export async function getGlossaryAnchorPayload(
  locale?: string,
): Promise<GlossaryAnchorPayload> {
  const key = resolve(locale);
  const cached = anchorPayloads.get(key);
  if (cached) return cached;
  const { bySpecKey, byLabel } = await getGlossaryAnchors(key);
  const slugs = new Set([...bySpecKey.values(), ...byLabel.values()]);
  const payload: GlossaryAnchorPayload = {
    terms: (await catalogue(key)).entries
      .filter((entry) => slugs.has(entry.slug))
      .map((entry) => ({
      slug: entry.slug,
      term: entry.term,
        short: entry.short,
      })),
    bySpecKey: Object.fromEntries(bySpecKey),
    byLabel: Object.fromEntries(byLabel),
  };
  anchorPayloads.set(key, payload);
  return payload;
}
