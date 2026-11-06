/**
 * Which vehicles of a battle were in a platoon, numbered the way the game does,
 * read from the battle's results as a replay carries them.
 *
 * **The mod does not use this.** It asks the client's own squad finder, which
 * is the authority and follows a new mode the day Wargaming ships it. This is
 * the same rule copied out of the client (`squad_finder.py` and each mode's
 * subclass) for the one place no client is there to ask: recovering the
 * platoons of battles recorded before the mod sent them, from their stored
 * replay. A mode added after this table was written reads as "no platoons",
 * never as a guess.
 *
 * The rule, as the client has it: a mode registers a finder for its arena GUI
 * type, or none (a training room has none, which is the whole point: its room
 * shares one `prebattleID`). Within a team, players sharing a `prebattleID`
 * are a platoon only when there are as many of them as a platoon in that mode
 * can hold, and platoons are numbered from 1 per team in `prebattleID` order.
 * Steel Hunter's multi-team mode numbers them across the whole battle instead.
 */
export enum SquadNumbering {
  /** From 1 within each team. */
  PerTeam = "team",
  /** From 1 across the whole battle (`ContinuousNumberingFinder`). */
  Continuous = "continuous",
}

type SquadFinder = {
  numbering: SquadNumbering;
  /** Smallest and largest group that counts as a platoon, inclusive. */
  min: number;
  max: number;
};

const STANDARD: SquadFinder = { numbering: SquadNumbering.PerTeam, min: 2, max: 3 };

/**
 * The client's registrations, by `ARENA_GUI_TYPE`, as of client 2.4. Absent
 * means the client registers no finder for it.
 */
export const SQUAD_FINDERS: Readonly<Record<number, SquadFinder>> = {
  1: STANDARD, // RANDOM
  7: STANDARD, // EVENT_BATTLES
  14: { numbering: SquadNumbering.Continuous, min: 2, max: 3 }, // FALLOUT_MULTITEAM
  19: STANDARD, // EPIC_RANDOM
  21: STANDARD, // EPIC_BATTLE (Frontline)
  23: STANDARD, // BATTLE_ROYALE (Steel Hunter)
  24: STANDARD, // MAPBOX
  29: STANDARD, // FUN_RANDOM
  30: { numbering: SquadNumbering.PerTeam, min: 2, max: 7 }, // COMP7 (Onslaught)
  35: { numbering: SquadNumbering.PerTeam, min: 2, max: 7 }, // COMP7_LIGHT
  101: { numbering: SquadNumbering.PerTeam, min: 2, max: 5 }, // HALLOWEEN
  102: { numbering: SquadNumbering.PerTeam, min: 2, max: 5 }, // LAST_STAND
  103: STANDARD, // FORT_RUSH
};

/** One player of the results' `players` block, as far as platoons need it. */
type ResultsPlayer = { team?: unknown; prebattleID?: unknown };

/** The part of a battle's results this reads. */
export type SquadResults = {
  common?: { guiType?: unknown };
  players?: Record<string, ResultsPlayer | null | undefined>;
  vehicles?: Record<string, unknown>;
};

const int = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/** `{battle vehicle id: platoon number}` for these results, empty when none. */
export function battleSquads(results: SquadResults): Map<number, number> {
  const out = new Map<number, number>();
  const finder = SQUAD_FINDERS[int(results.common?.guiType)];
  if (!finder) return out;

  // The vehicle each account drove, keyed the way the results key vehicles.
  const vehicleOf = new Map<number, number>();
  for (const [key, entry] of Object.entries(results.vehicles ?? {})) {
    const records = Array.isArray(entry) ? entry : [entry];
    for (const record of records) {
      const account = int((record as { accountDBID?: unknown } | null)?.accountDBID);
      if (account) {
        vehicleOf.set(account, int(key));
        break;
      }
    }
  }

  // team -> prebattleID -> vehicles
  const groups = new Map<number, Map<number, number[]>>();
  for (const [account, player] of Object.entries(results.players ?? {})) {
    const vehicle = vehicleOf.get(int(account));
    const prebattle = int(player?.prebattleID);
    if (!vehicle || !prebattle) continue;
    const team = int(player?.team);
    const byTeam = groups.get(team) ?? new Map<number, number[]>();
    groups.set(team, byTeam);
    byTeam.set(prebattle, [...(byTeam.get(prebattle) ?? []), vehicle]);
  }

  let next = 0;
  for (const team of [...groups.keys()].sort((a, b) => a - b)) {
    if (finder.numbering === SquadNumbering.PerTeam) next = 0;
    const byTeam = groups.get(team)!;
    for (const prebattle of [...byTeam.keys()].sort((a, b) => a - b)) {
      const vehicles = byTeam.get(prebattle)!;
      if (vehicles.length < finder.min || vehicles.length > finder.max) continue;
      next += 1;
      for (const vehicle of vehicles) out.set(vehicle, next);
    }
  }
  return out;
}
