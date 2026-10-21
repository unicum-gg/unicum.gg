import type { TankBattleMode } from "./tank-modes";

/**
 * The counters one battle-mode block reports.
 *
 * The first eighteen are in every block Wargaming answers, zeroed rather than
 * absent on a vehicle the mode was never played in. The rest depend on the
 * mode: the armour figures come with `fallout`, `globalmap` and the two
 * Stronghold blocks only, and the record scores with every mode except
 * `company` and `globalmap`. See `TankBattleMode`.
 */
export type TankModeStatistics = {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  survived_battles: number;
  frags: number;
  damage_dealt: number;
  damage_received: number;
  spotted: number;
  capture_points: number;
  dropped_capture_points: number;
  xp: number;
  hits: number;
  shots: number;
  radio_assisted_damage: number;
  track_assisted_damage: number;
  stun_number: number;
  stun_assisted_damage: number;
  piercings?: number;
  /** Per battle, as Wargaming reports it. Stored cumulative. */
  avg_damage_blocked?: number;
  tanking_factor?: number;
  /** The game's Record Score, for this mode. Maxima, never to be diffed. */
  max_damage?: number;
  max_xp?: number;
  max_frags?: number;
};

/** The curated per-tank shape the app consumes (a narrow slice of the WG
 * response). Client-safe type (no I/O); the fetcher lives in core
 * (`wargaming/wot/tanks`). */
export type TankStats = {
  tank_id: number;
  mark_of_mastery: number | null;
  // Marks of Excellence on the gun (0-3). Not part of the WG public API — merged
  // in from the WoT portal, so it is optional/absent on the raw API shape.
  marks_on_gun?: number | null;
  /**
   * How far along the next mark of excellence is, 0 to 100 with two decimals.
   *
   * Not in Wargaming's public API and not on the portal either: the only place
   * this number exists is the vehicle dossier inside the client, so it reaches
   * us from the mod's garage sweep or not at all. Null means nobody has told
   * us, which is different from a gun with no progress.
   *
   * Until this arrived the site ESTIMATED the figure by dividing a player's
   * average combined damage by the threshold for the next mark. That estimate
   * is still what shows for an account without the mod.
   */
  mark_percent?: number | null;
  /** Personal bests on the vehicle, the game's "Record Score". Top level in
   * Wargaming's response, not inside a battle-mode block. */
  max_xp?: number;
  max_frags?: number;
  all: {
    battles: number;
    damage_dealt: number;
    spotted: number;
    frags: number;
    dropped_capture_points: number;
    wins: number;
    radio_assisted_damage: number;
    track_assisted_damage: number;
    xp: number;
    // Added for the per-tank server-average table. `piercings` and
    // `avg_damage_blocked` are optional in WG's response; the rest are always
    // present but may be absent on tanks with no random battles.
    survived_battles?: number;
    hits?: number;
    shots?: number;
    piercings?: number;
    avg_damage_blocked?: number;
    // The rest of the in-game vehicle record. Optional for the same reason as
    // the block above: a tank with no random battles reports none of them.
    damage_received?: number;
    capture_points?: number;
    stun_number?: number;
    stun_assisted_damage?: number;
    /** Wargaming's armor use efficiency. A ratio, so it neither sums across
     * tanks nor diffs between snapshots. */
    tanking_factor?: number;
  };
};

/**
 * The same row with the per-mode blocks beside `all`.
 *
 * Wargaming puts them at the top level as siblings of `all`, keyed by the mode
 * name, so the shape follows theirs: a mapped type over `TankBattleMode`, whose
 * values ARE those keys. Every block is optional because `fields` decides which
 * come back, and `null` is Wargaming's answer for an `extra` block on a vehicle
 * the mode was never played in (the non-extra blocks come back zeroed instead).
 *
 * A supertype of `TankStats`, so the readers that only ever wanted `all` keep
 * taking the narrow type and need no change.
 */
export type TankStatsWithModes = TankStats &
  Partial<Record<TankBattleMode, TankModeStatistics | null>>;
