import type { TankStats } from "../tank-stats";

// Pure, db-free vehicle metadata shape and helpers. Kept apart from
// `encyclopedia.ts` (which imports `db`) so client components can pull
// `computeAvgTier` / `VehicleMeta` into the browser bundle without dragging
// the Postgres driver (and its `fs`/`os` node built-ins) along with them.
export type VehicleMeta = {
  tier: number;
  type: string;
  nation: string;
  name: string;
  shortName: string;
  tag: string;
  isPremium: boolean;
  isReward: boolean;
  /** Only on the Common Test client: unreleased, and not in any player's stats. */
  isCommonTest: boolean;
  /**
   * Not a vehicle at all: a training-room dummy, a story-mode prop, or
   * something the client never names. An event's bots and bosses are not this:
   * they have a page, and `eventRole` is what marks them. None has a single battle on any region, so they are
   * kept out of every catalogue surface, slugs included. Playable variants the
   * client files apart (the cybercafe IGR reissues) are not this: they are in
   * the catalogue, under a suffixed name.
   */
  isHidden: boolean;
  /**
   * The parallel catalogue this vehicle comes from, as it is spelled at the end
   * of its name ("IGR"), or null for a normal one. The name carries it so slugs
   * and lists stay unambiguous; this field is what lets the page mark it as a
   * term rather than leave an unexplained acronym in the title.
   * `EVENT_VEHICLE_VARIANT` marks an event mode's vehicle.
   */
  variant: string | null;
  /**
   * The part an event's bot plays in it, as the client tags it (`boss`,
   * `sentry`, `alpha`, ...), or null for anything a player drives. Its page
   * shows what it is and leaves out everything only players produce.
   */
  eventRole: string | null;
  role: string | null;
  contourIcon: string | null;
  bigIcon: string | null;
};

// Battle-weighted average tier across a set of tanks. Tanks with no
// encyclopedia entry or zero battles are ignored; returns null when nothing
// qualifies.
export function computeAvgTier(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  let weighted = 0;
  let total = 0;
  for (const tank of tanks) {
    const meta = encyclopedia[String(tank.tank_id)];
    const battles = tank.all?.battles ?? 0;
    if (!meta || battles <= 0) continue;
    weighted += meta.tier * battles;
    total += battles;
  }
  return total > 0 ? weighted / total : null;
}

/**
 * `VehicleMeta.variant` for a vehicle that exists only inside an event mode.
 *
 * Unlike "IGR" it is not spelled in the name: the event names its vehicles
 * itself. The catalogue offers these behind a filter of their own, and nothing
 * that compares vehicles by tier may count them. Its bots and bosses are among
 * them, marked by `VehicleMeta.eventRole`.
 */
export const EVENT_VEHICLE_VARIANT = "EVENT";

/** `VehicleMeta.eventRole` of an event's boss, which the page names as one. */
export const EVENT_BOSS_ROLE = "boss";
