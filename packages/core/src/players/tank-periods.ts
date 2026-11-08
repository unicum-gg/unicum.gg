import type { PlayerPeriodStats, Stats, TankSnapshot } from "@unicum.gg/shared";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import type { TankSnapshotMap } from "./tanks";

/** The counters a vehicle row may not hold, keyed as `TankStats["all"]`. */
const OPTIONAL_COUNTERS = [
  "survived_battles",
  "hits",
  "shots",
  "capture_points",
  "draws",
] as const;
type OptionalCounter = (typeof OPTIONAL_COUNTERS)[number];

/** Where each of them sits on a stored baseline row. */
const BASELINE_FIELD = {
  survived_battles: "survivedBattles",
  hits: "hits",
  shots: "shots",
  capture_points: "capturePoints",
  draws: "draws",
} as const satisfies Record<OptionalCounter, keyof TankSnapshot>;

export type TankPeriod = {
  /** One entry per vehicle played in the window, its counters over it. */
  tanks: TankStats[];
  stats: PlayerPeriodStats;
};

/**
 * One of the profile's 24h/7d/30d columns, read off the vehicles alone.
 *
 * Wargaming refreshes `account/info` when the player logs out and `tanks/stats`
 * after every battle, so the vehicles are the only side that is current during
 * a session, and taking the battles from the account and the ratings from the
 * vehicles made a column contradict itself (okuni on EU, 2026-11-03: 0 battles
 * under an average tier and a WN8). Every counter of the column now comes from
 * the same diff, and only the two account ratings, which exist nowhere else,
 * come from `account`.
 *
 * A vehicle missing from `past` is one first played inside the window (see
 * `loadPlayerInitialData` for the baseline rule that makes absence mean that),
 * so all of its battles count. The old diff skipped it, which dropped a new
 * vehicle's first battles from every period figure.
 *
 * A counter some played vehicle cannot answer, its baseline row predating the
 * column, is null for the whole window rather than a sum of the vehicles that
 * can: an understated total looks exactly like a real one.
 *
 * Null when there is no baseline at all, since every vehicle would then read
 * as new and the window would be the career.
 */
export function tankPeriod(
  current: TankStats[],
  past: TankSnapshotMap,
  account: Stats | null,
): TankPeriod | null {
  if (past.size === 0) return null;

  const tanks: TankStats[] = [];
  let battles = 0;
  let wins = 0;
  let frags = 0;
  let damageDealt = 0;
  let xp = 0;
  let spotted = 0;
  let droppedCapturePoints = 0;
  const optional: Record<OptionalCounter, number | null> = {
    survived_battles: 0,
    hits: 0,
    shots: 0,
    capture_points: 0,
    draws: 0,
  };

  for (const t of current) {
    const p = past.get(t.tank_id);
    const battlesDiff = t.all.battles - (p?.battles ?? 0);
    if (battlesDiff <= 0) continue;

    const all: TankStats["all"] = {
      battles: battlesDiff,
      wins: t.all.wins - (p?.wins ?? 0),
      damage_dealt: t.all.damage_dealt - (p?.damageDealt ?? 0),
      spotted: t.all.spotted - (p?.spotted ?? 0),
      frags: t.all.frags - (p?.frags ?? 0),
      dropped_capture_points:
        t.all.dropped_capture_points - (p?.droppedCapturePoints ?? 0),
      radio_assisted_damage:
        t.all.radio_assisted_damage - (p?.radioAssistedDamage ?? 0),
      track_assisted_damage:
        t.all.track_assisted_damage - (p?.trackAssistedDamage ?? 0),
      xp: t.all.xp - (p?.xp ?? 0),
    };
    for (const key of OPTIONAL_COUNTERS) {
      const now = t.all[key];
      const then = p ? p[BASELINE_FIELD[key]] : 0;
      const sum = optional[key];
      if (now == null || then == null) {
        optional[key] = null;
      } else {
        all[key] = now - then;
        if (sum !== null) optional[key] = sum + (now - then);
      }
    }
    tanks.push({ tank_id: t.tank_id, mark_of_mastery: t.mark_of_mastery, all });

    battles += all.battles;
    wins += all.wins;
    frags += all.frags;
    damageDealt += all.damage_dealt;
    xp += all.xp;
    spotted += all.spotted;
    droppedCapturePoints += all.dropped_capture_points;
  }

  const draws = optional.draws;
  return {
    tanks,
    stats: {
      battles,
      wins,
      losses: draws === null ? null : battles - wins - draws,
      draws,
      survivedBattles: optional.survived_battles,
      frags,
      damageDealt,
      xp,
      spotted,
      capturePoints: optional.capture_points,
      droppedCapturePoints,
      hits: optional.hits,
      shots: optional.shots,
      globalRating: account?.globalRating ?? null,
      wtr: account?.wtr ?? null,
    },
  };
}
