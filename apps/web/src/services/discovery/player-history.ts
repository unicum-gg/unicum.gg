import {
  getStoredPlayerClanHistory,
  loadPlayerClanHistoryFromWG,
  storePlayerClanHistory,
} from "@/services/players/clan-history";
import type { Region } from "@/services/wargaming/wot";
import type { PlayerClanHistoryFull } from "@/services/wargaming/wot/clans/player";
import { discoverClans } from "./clans";

function collectClanIds(data: PlayerClanHistoryFull): number[] {
  const ids = new Set<number>();
  if (data.currentStint) ids.add(data.currentStint.clan.id);
  for (const s of data.pastStints) ids.add(s.clan.id);
  return Array.from(ids);
}

/**
 * For never-before-seen players, fetch their full clan history once
 * and enqueue every clan they have ever been in. Fire-and-forget.
 * Skips if a cached history already exists (player page visit covered it).
 */
export function discoverFromClanHistoryBackground(
  region: Region,
  accountId: number,
): void {
  void (async () => {
    try {
      const cached = await getStoredPlayerClanHistory(region, accountId);
      if (cached) return;
      const history = await loadPlayerClanHistoryFromWG(region, accountId);
      await storePlayerClanHistory(region, accountId, history);
      const ids = collectClanIds(history);
      if (ids.length > 0) await discoverClans(region, ids);
    } catch (err) {
      console.warn(
        `[spider] clan history fetch failed for ${region}/${accountId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  })();
}
