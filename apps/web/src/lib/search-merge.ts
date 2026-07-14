/** How many results a streamed search section displays. Matches the server's
 * per-source limit so the list settles at one page instead of doubling (5 local
 * + 5 remote) when the Wargaming chunk lands. */
export const SEARCH_DISPLAY_LIMIT = 5;

/**
 * Merge the local and remote chunks of a streamed search into one display list:
 * the exact match first (it usually arrives in the remote chunk and must not be
 * pushed below weaker prefix hits), then local hits (battle/member-ordered),
 * then remote, deduped by key and capped at `limit`.
 */
export function mergeSearchChunks<T>(
  local: T[],
  remote: T[],
  key: (item: T) => string,
  query: string,
  limit = SEARCH_DISPLAY_LIMIT,
): T[] {
  const q = query.toLowerCase();
  const pool = [...local, ...remote];
  const exact = pool.filter((r) => key(r).toLowerCase() === q);
  const out: T[] = [];
  const seen = new Set<string>();
  for (const r of [...exact, ...pool]) {
    const k = key(r).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
