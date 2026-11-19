import type { BattleEnemyDetail } from "../../db/schema/battle-replays";
import type { ReplayHeader } from "./parse";

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** What a replay's own results say about its recorder, beyond the economy. */
export type RecorderPerformance = {
  /** The game's "battle performance": what they did to each enemy. */
  details: BattleEnemyDetail[];
  /** The mastery badge the battle earned, 0 for none. */
  markOfMastery: number;
};

/**
 * The recorder's per-enemy results and mastery badge, from the file's results
 * block. Null for a battle left before its end, which writes no results.
 *
 * `personal` holds one entry per vehicle the recorder fielded (several in a
 * Frontline lineup) plus `avatar`; each entry's `details` is keyed
 * `"(vehicleId, 0)"`, the enemy's battle-scoped id first. The lineup's entries
 * are summed per enemy, since the panel is about the battle, not each tank.
 */
export function recorderPerformance(header: ReplayHeader): RecorderPerformance | null {
  let results: Fields | null = null;
  for (const part of header.blocks.slice(1)) {
    const candidate = Array.isArray(part) ? part[0] : part;
    if (isRecord(candidate) && isRecord(candidate.personal)) {
      results = candidate;
      break;
    }
  }
  if (!results) return null;
  const personal = results.personal as Fields;
  const byEnemy = new Map<number, BattleEnemyDetail>();
  let markOfMastery = 0;
  for (const [name, entry] of Object.entries(personal)) {
    if (name === "avatar" || !isRecord(entry)) continue;
    markOfMastery = Math.max(markOfMastery, num(entry.markOfMastery));
    if (!isRecord(entry.details)) continue;
    for (const [key, raw] of Object.entries(entry.details)) {
      const vehicle = Number(/^\(?\s*(\d+)/.exec(key)?.[1]);
      if (!Number.isFinite(vehicle) || !isRecord(raw)) continue;
      const one = byEnemy.get(vehicle) ?? {
        vehicle,
        spotted: false,
        assisted: 0,
        crits: false,
        damageDealt: 0,
        directHits: 0,
        piercings: 0,
        killed: false,
        blocked: 0,
        blockedHits: 0,
        stuns: 0,
      };
      one.spotted ||= num(raw.spotted) > 0;
      one.assisted +=
        num(raw.damageAssistedRadio) + num(raw.damageAssistedTrack) + num(raw.damageAssistedStun);
      one.crits ||= num(raw.crits) > 0;
      one.damageDealt += num(raw.damageDealt);
      one.directHits += num(raw.directHits);
      one.piercings += num(raw.piercings);
      one.killed ||= num(raw.targetKills) > 0;
      // What came the other way: the game's "armour" mark on an enemy is the
      // damage the recorder's armour took off its shots.
      one.blocked = (one.blocked ?? 0) + num(raw.damageBlockedByArmor);
      one.blockedHits =
        (one.blockedHits ?? 0) + num(raw.noDamageDirectHitsReceived) + num(raw.rickochetsReceived);
      one.stuns = (one.stuns ?? 0) + num(raw.stunNum);
      byEnemy.set(vehicle, one);
    }
  }
  return { details: [...byEnemy.values()], markOfMastery };
}
