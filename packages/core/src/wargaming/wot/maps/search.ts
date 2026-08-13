import type { Region } from "@unicum.gg/wargaming";
import { listMapSummaries } from "./index";

export type MapSearchResult = {
  arena_id: string;
  slug: string;
  name: string;
  camouflage: string;
  minimap_url: string;
};

/**
 * Prefix/substring search over the battle-map catalogue. Runs entirely in memory
 * against the cached, name-deduped catalogue (~56 maps), so it's instant and
 * never touches the DB. Ranks exact name matches first, then prefix, then
 * substring; ties break alphabetically. Matching is alphanumeric-insensitive so
 * "prokhorovka" and "prohorovka" both hit, "elhalluf" matches "El Halluf".
 */
export async function searchMaps(
  region: Region,
  query: string,
  limit = 5,
): Promise<MapSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const qa = alnum(q);
  const summaries = await listMapSummaries(region);

  type Scored = { entry: MapSearchResult; score: number };
  const scored: Scored[] = [];
  for (const m of summaries) {
    const name = m.name.toLowerCase();
    const nameA = alnum(name);
    let score = 0;
    if (name === q || nameA === qa) score = 3;
    else if (name.startsWith(q) || nameA.startsWith(qa)) score = 2;
    else if (name.includes(q) || (qa.length > 0 && nameA.includes(qa))) score = 1;
    if (score === 0) continue;
    scored.push({
      score,
      entry: {
        arena_id: m.arenaId,
        slug: m.slug,
        name: m.name,
        camouflage: m.camouflage,
        minimap_url: m.minimapUrl,
      },
    });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name),
  );
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * The same rows, addressed by arena id instead of by name. Backs the search
 * dialog's saved entries, which keep the id and ask for the current row rather
 * than storing a copy of it.
 *
 * Unknown ids are dropped: a map can leave the rotation, and the caller has its
 * own copy for that case.
 */
export async function getMapsByIds(
  region: Region,
  arenaIds: string[],
): Promise<MapSearchResult[]> {
  if (arenaIds.length === 0) return [];
  const wanted = new Set(arenaIds);
  const summaries = await listMapSummaries(region);
  return summaries
    .filter((m) => wanted.has(m.arenaId))
    .map((m) => ({
      arena_id: m.arenaId,
      slug: m.slug,
      name: m.name,
      camouflage: m.camouflage,
      minimap_url: m.minimapUrl,
    }));
}
