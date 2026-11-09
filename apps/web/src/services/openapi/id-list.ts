/**
 * The comma-separated id list the public resolve endpoints take (`search/resolve`
 * and `{region}/resolve`), read once so a fix reaches both.
 *
 * Every occurrence of the parameter is read, not just the first: a caller that
 * builds its query string incrementally sends `?players=1,2&players=3,4`, and
 * `URLSearchParams.get` would answer with the first pair and drop the rest
 * silently, which on an endpoint whose contract is that an absent id means "we
 * hold nothing for it" is a wrong answer rather than a partial one.
 */
export function idList(query: URLSearchParams, name: string): string[] {
  return query
    .getAll(name)
    .flatMap((raw) => raw.split(","))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** A parsed id, or null for an entry that is not one. Kept distinct from a
 * dropped entry so a caller can be told how many ids it really sent. */
function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** The ids, dropping anything that is not one. A stored list is whatever a
 * browser held, so a malformed entry is skipped rather than failing the whole
 * call and leaving the reader with no list at all. */
export function numericIds(query: URLSearchParams, name: string): number[] {
  return idList(query, name)
    .map(parseId)
    .filter((n): n is number => n !== null);
}

/**
 * `<account>:<vehicle>` pairs, alongside how many entries were written.
 *
 * Two ids in one entry rather than two parallel lists, because the pairing is
 * the question: a battle asks what THIS player does on THE vehicle they
 * brought, and two lists a caller has to keep aligned is a contract where a
 * dropped entry silently re-pairs every one after it.
 *
 * Counted like the id lists beside it, and for the same reason: a malformed
 * entry is dropped, so a caller that must account for everything it sent
 * needs the figure from before the dropping.
 */
export function countedPairs(
  query: URLSearchParams,
  name: string,
): { pairs: Array<{ left: number; right: number }>; sent: number } {
  const entries = idList(query, name);
  const pairs: Array<{ left: number; right: number }> = [];
  for (const entry of entries) {
    const halves = entry.split(":");
    if (halves.length !== 2) continue;
    const left = parseId(halves[0]);
    const right = parseId(halves[1]);
    if (left !== null && right !== null) pairs.push({ left, right });
  }
  return { pairs, sent: entries.length };
}

/** The same ids, alongside how many entries were written, so a caller that must
 * account for every id it sent can refuse a list that is too long BEFORE the
 * malformed entries are dropped. Counting after would let 101 entries with one
 * typo through as 100, and the dropped id would then be indistinguishable from
 * one we simply hold nothing for. */
export function countedNumericIds(
  query: URLSearchParams,
  name: string,
): { ids: number[]; sent: number } {
  const entries = idList(query, name);
  return {
    ids: entries.map(parseId).filter((n): n is number => n !== null),
    sent: entries.length,
  };
}
