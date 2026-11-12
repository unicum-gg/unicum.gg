import type { Region, StrongholdModeStats } from "@unicum.gg/wargaming";
import { wg } from "../../client";

export type { ClanStrongholdData } from "@unicum.gg/wargaming";

export const fetchClanStronghold = (region: Region, clanId: number) =>
  wg.region(region).stronghold.clan({ clanId });

const SKIRMISH_T11_FIELDS = [
  "skirmish_statistics.total_11",
  "skirmish_statistics.total_11_in_28d",
  "skirmish_statistics.win_11",
] as const;

/**
 * Tier XI Skirmish records, from the documented API because the `wgsh-*` host
 * that carries every other tier still answers 6, 8 and 10 only (checked
 * 2026-11-09 against clans holding hundreds of tier XI battles).
 *
 * Logs and returns what it has rather than throwing: this call is on another
 * budget than the sample it accompanies, and a clan missing from the map keeps
 * its last tier XI figures, so a failure here must not cost the other tiers.
 */
export async function fetchClanSkirmishT11(
  region: Region,
  clanIds: number[],
): Promise<Map<number, StrongholdModeStats>> {
  const records = new Map<number, StrongholdModeStats>();
  try {
    const rows = await wg.region(region).api.wot.stronghold.claninfoBatch({
      clanIds,
      fields: SKIRMISH_T11_FIELDS,
    });
    for (const [clanId, row] of rows) {
      const stats = row.skirmish_statistics;
      if (stats?.total_11 == null || stats.win_11 == null) continue;
      records.set(clanId, {
        battles: stats.total_11,
        wins: stats.win_11,
        battles28d: stats.total_11_in_28d ?? 0,
      });
    }
  } catch (err) {
    console.error(`[clan-stronghold-${region}] tier XI read failed:`, err);
  }
  return records;
}
