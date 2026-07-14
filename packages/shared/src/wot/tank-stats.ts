/** The curated per-tank shape the app consumes (a narrow slice of the WG
 * response). Client-safe type (no I/O); the fetcher lives in core
 * (`wargaming/wot/tanks`). */
export type TankStats = {
  tank_id: number;
  mark_of_mastery: number | null;
  // Marks of Excellence on the gun (0-3). Not part of the WG public API — merged
  // in from the WoT portal, so it is optional/absent on the raw API shape.
  marks_on_gun?: number | null;
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
  };
};
