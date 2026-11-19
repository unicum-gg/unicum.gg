import type { ReplayShot } from "./replay-shots";

export type Bounds = {
  bottomLeft: { x: number; z: number };
  upperRight: { x: number; z: number };
};

/** One vehicle's path, as the endpoint sends it: `[clock ticks, x, z]`. */
export type Track = {
  id: number;
  points: [number, number, number][];
  /** The tick it was destroyed, in this same clock, or null if it survived. */
  diedAt: number | null;
  maxHealth: number;
  /** `[tick, hit points]`, one entry per change, implicitly starting at full. */
  health: [number, number][];
  /** `[tick, radians from north towards east]`: where the gun points. */
  aim?: [number, number][];
  /** Where it was while past the recorder's 565 m, `[tick, x, z]`, every two
   * seconds, as its minimap drew it. */
  far?: [number, number, number][];
};
/** One line somebody typed, as the endpoint hands it over: plain text, never markup. */
export type ChatLine = {
  at: number;
  from: string;
  vehicle: string | null;
  text: string;
  ally: boolean;
  /** Set when the line is a quick command rather than something typed. */
  command?: string | null;
  /** The sender's vehicle id for a command, to resolve against `byId`. */
  sender?: number | null;
  /** Where the command pinged, in the arena's metres, or null for most of them. */
  where?: { x: number; z: number } | null;
  /** The vehicle the command is about, for `%(target)s`. */
  target?: number | null;
  /** Seconds left on a reload, for `%(reloadTime)d`. */
  reloadTime?: number | null;
  /** A base or objective label, for `%(strArg1)s`. */
  label?: string | null;
};

/** One vehicle destroyed, with whoever did it where the recording heard who. */
export type Death = {
  at: number;
  victim: number;
  by: number | null;
  damage: number | null;
  /** The game's own `deathReason`, which picks the sentence. */
  reason?: number | null;
};

export type Motion = {
  duration: number;
  ticksPerSecond: number;
  /** The tick the countdown ends; before it nothing moves and all is visible. */
  startsAt: number;
  tracks: Track[];
  /** Optional, because a browser may hold an answer from before this existed. */
  chat?: ChatLine[];
  deaths?: Death[];
  shots?: ReplayShot[];
  /** The recorder's view range as the server sent it, `[tick, metres]`. */
  vision?: [number, number][];
  /** The recorder's rounds left, `[tick, place in the rack, rounds]`. */
  ammo?: [number, number, number][];
  /** The recorder's modules and crew, `[tick, extra, DAMAGE_INFO_CODES index]`. */
  ownDamage?: [number, number, number][];
  /** The recorder's feed, `[tick, type, target, amount]`. */
  events?: [number, number, number, number][];
  /** The recorder's commander's view of their target. */
  targetDamage?: { at: number; vehicle: number; damaged: number[]; destroyed: number[] }[];
  /** Every hit heard, `[tick, attacker, victim, damage]`. */
  hits?: [number, number, number, number][];
  /** When the recorder was spotted, in ticks: each lit the sixth sense. */
  observed?: number[];
  /** The recorder's loadout per life, which names their vehicle. */
  loadouts?: { vehicle: number; crew?: { role: string }[] }[];
};
