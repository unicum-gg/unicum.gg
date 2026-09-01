import type { GlossarySummary } from "./entry";

/** Ranks a match by how directly it answers the query. Kept ordinal rather than
 * weighted: the four cases are qualitatively different, and a definition hit is
 * always worth less than a name hit however many words it matches. */
enum GlossaryMatch {
  None = 0,
  /** The query is in the entry's own sentence, but names nothing. */
  Definition = 1,
  /** A name the term is known by contains the query. */
  Contains = 2,
  /** A name the term is known by starts with the query. */
  Prefix = 3,
  /** The query is one of the term's names, spelled out. */
  Exact = 4,
}

/** Case- and punctuation-insensitive, so "hulldown" finds "Hull-down" and
 * "peekaboo" finds "Peek-a-boo". Only ever used for a whole-name or
 * start-of-name comparison: applied to `includes` it would also match across a
 * word boundary the reader can see ("gepe" inside "damage per game"). */
function packed(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The best a term's names do against the query, and which name did it: its
 * length, and whether it was the term's own name rather than an alias. */
type NameHit = { score: GlossaryMatch; length: number; isTerm: boolean };

const NO_HIT: NameHit = {
  score: GlossaryMatch.None,
  length: 0,
  isTerm: false,
};

/**
 * How well the query matches one of the names a term is known by.
 *
 * Which name won is carried out because it is what the tiebreak has to compare.
 * Ranking by the term's own length instead put a short entry above the very
 * term the reader typed whenever the short one matched through a long alias:
 * "art" ranked Stun (through "artillery stun") above Artillery, and "prem"
 * ranked IGR (through "premium IGR") above Premium tank.
 *
 * The `Contains` tier is anchored at a word boundary, like the definition tier
 * below and for the same reason: a reader types the start of a word ("halluf"
 * for "El Halluf"), never the middle of one, and matching mid-word made every
 * short query drag in whatever happened to spell it inside a longer word
 * ("and" pulled in Random Battles, Gun handling and Crew role's "commander").
 */
function nameHit(
  entry: GlossarySummary,
  q: string,
  qa: string,
  wordStart: RegExp,
): NameHit {
  let best = NO_HIT;
  const names = [entry.term, ...entry.aliases];
  for (const [index, name] of names.entries()) {
    const lower = name.toLowerCase();
    const flat = packed(name);
    const score =
      lower === q || (qa.length > 0 && flat === qa)
        ? GlossaryMatch.Exact
        : lower.startsWith(q) || (qa.length > 0 && flat.startsWith(qa))
          ? GlossaryMatch.Prefix
          : wordStart.test(name)
            ? GlossaryMatch.Contains
            : GlossaryMatch.None;
    if (score === GlossaryMatch.None) continue;
    const isTerm = index === 0;
    const better =
      score > best.score ||
      (score === best.score &&
        // The name it is actually called beats a name it is also known by, so
        // "gun" opens Gun arc rather than Crew role through its "gunner" alias.
        (isTerm !== best.isTerm ? isTerm : name.length < best.length));
    if (better) best = { score, length: name.length, isTerm };
  }
  return best;
}

/**
 * A word that appears in more than this share of the definitions describes the
 * subject matter rather than any one term, so matching on it says nothing.
 *
 * Derived from the catalogue on each query instead of from a list of stopwords,
 * because the words that carry no information here are not the ones a general
 * stopword list holds: "the" and "and" are useless, but so are "damage",
 * "battle" and "player", and a hand-kept list would have to be revisited every
 * time the glossary grows. The share is what makes both fall out on their own.
 */
const COMMON_WORD_SHARE = 0.15;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The words of the query worth searching the definitions for, as start-of-word
 * matchers.
 *
 * Anchored at a word boundary so "art" does not match "part", and filtered by
 * how many definitions each word appears in: without that, every three-letter
 * query (the dialog's own minimum) filled the glossary section with five
 * unrelated terms, since "the", "and" and "for" are in nearly every sentence
 * the catalogue holds.
 */
function definitionWords(
  terms: readonly GlossarySummary[],
  words: string[],
): RegExp[] {
  const ceiling = terms.length * COMMON_WORD_SHARE;
  const useful: RegExp[] = [];
  for (const word of words) {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}`, "i");
    let hits = 0;
    for (const entry of terms) {
      if (pattern.test(entry.short) && ++hits > ceiling) break;
    }
    if (hits <= ceiling) useful.push(pattern);
  }
  return useful;
}

/**
 * Search the glossary by name, by any spelling the term is also known by, and,
 * failing both, by its definition.
 *
 * The definition tier is what makes the search usable by the reader who needs
 * it most: someone who has met the thing in a battle result and has no name for
 * it yet types a word of what it does ("bounce"), not what it is called. It
 * ranks below every name match, so a reader who does know the word still gets
 * that term first, and it takes each word of the query separately rather than
 * the whole string, since a description is recalled in fragments.
 *
 * Pure and synchronous over a list the caller already holds: the catalogue is a
 * few hundred entries that ship with the build, so a search is a scan, never a
 * query. `limit` is optional because the two readers want different amounts of
 * it: the search dialog shows a section of five, the glossary index filters the
 * whole page.
 */
export function searchGlossaryTerms(
  terms: readonly GlossarySummary[],
  query: string,
  limit?: number,
): GlossarySummary[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const qa = packed(q);
  const wordStart = new RegExp(`\\b${escapeRegExp(q)}`, "i");
  const words = definitionWords(terms, q.split(/\s+/).filter(Boolean));

  const scored: { entry: GlossarySummary; hit: NameHit }[] = [];
  for (const entry of terms) {
    let hit = nameHit(entry, q, qa, wordStart);
    if (
      hit.score === GlossaryMatch.None &&
      words.length > 0 &&
      words.every((word) => word.test(entry.short))
    ) {
      hit = {
        score: GlossaryMatch.Definition,
        length: entry.term.length,
        isTerm: true,
      };
    }
    if (hit.score === GlossaryMatch.None) continue;
    scored.push({ entry, hit });
  }

  // Shortest matched name first within a tier: a query that prefixes both "DPM"
  // and "DPM (effective)" wants the plain one, and the same rule reads as
  // alphabetical for the ties it cannot separate.
  scored.sort(
    (a, b) =>
      b.hit.score - a.hit.score ||
      Number(b.hit.isTerm) - Number(a.hit.isTerm) ||
      a.hit.length - b.hit.length ||
      a.entry.term.localeCompare(b.entry.term),
  );
  const ranked = scored.map((s) => s.entry);
  return limit === undefined ? ranked : ranked.slice(0, limit);
}
