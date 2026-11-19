import type { Region } from "@unicum.gg/wargaming";
import { BATTLE_MEDALS, iconUrl } from "@unicum.gg/shared";
import { getCatalog } from "@unicum.gg/core/players/achievements";
import type { WgLanguage } from "@unicum.gg/wargaming";

/** One medal a battle awarded, named and pictured. */
export type BattleMedal = {
  /** The game's own name for it, which is also its picture's file name. */
  key: string;
  /** Its title in the requested language, from Wargaming's catalogue. */
  name: string;
  image: string;
};

/**
 * The medals awarded in a battle, by their record id, named and pictured.
 *
 * The results carry record ids alone; `BATTLE_MEDALS` (generated from the
 * client) turns each into the medal's name, and Wargaming's achievement
 * catalogue, the one the profile's cabinet reads, names it in the reader's
 * language and pictures it. A medal the catalogue does not list (an event one)
 * keeps its key as its name and takes its picture from the client's own files.
 * An id that is no medal at all is left out.
 */
export async function nameBattleMedals(
  region: Region,
  language: WgLanguage | undefined,
  ids: number[],
): Promise<Record<string, BattleMedal>> {
  const wanted = [...new Set(ids)].filter((id) => BATTLE_MEDALS[id]);
  if (wanted.length === 0) return {};
  const catalog = await getCatalog(region, language);
  const byKey = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  return Object.fromEntries(
    wanted.map((id) => {
      const key = BATTLE_MEDALS[id];
      const entry = byKey.get(key);
      return [
        String(id),
        {
          key,
          name: entry?.name || key,
          image: entry?.image || iconUrl(`achievement/${key}.png`),
        },
      ];
    }),
  );
}
