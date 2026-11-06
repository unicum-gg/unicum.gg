import type {
  BattleVehicle,
  BattleVehicleTank,
  TankStats,
} from "@unicum.gg/shared";

/**
 * The tanks one vehicle fought a battle in.
 *
 * One everywhere but the respawn modes. Frontline lets a player come back in
 * another tank, and the results then carry one record per tank under the same
 * battle vehicle id: the vehicle's own counters are the whole battle, and
 * `tanks` says which tank did what. Before the mod sent `tanks`, only the
 * first of them was named and the whole battle was drawn under it, which is
 * still what a Frontline battle recorded then looks like: those other tanks
 * were never reported and cannot be recovered.
 */

/** Every tank id this vehicle fought in, known ones only, first one first. */
export function vehicleTankIds(vehicle: BattleVehicle): number[] {
  const ids = vehicle.tanks?.length
    ? vehicle.tanks.map((one) => one.tank)
    : [vehicle.tank];
  return ids.filter((id): id is number => id !== null && id > 0);
}

/** The vehicle's line without its per-tank breakdown, which rides named. */
export function withoutTanks(vehicle: BattleVehicle): BattleVehicle {
  if (!vehicle.tanks) return vehicle;
  const rest = { ...vehicle };
  delete rest.tanks;
  return rest;
}

/**
 * The battle as the career records the rating accumulators read, one per tank.
 *
 * Not a trick: the ratings are defined on battle counters and only ever
 * averaged, so a career of one battle is the metric at its own grain. Every
 * term maps straight across, `dropped_capture_points` included, which the
 * results call `capturePoints` on the vehicle that took them back.
 *
 * A vehicle that fought in several tanks gives one record per tank, each
 * rated against ITS OWN expected values. Rating the totals against the first
 * tank's expectations would judge a heavy's damage by a light's bar, and the
 * accumulators already know how to average several records into one figure.
 * The capture points are not broken down per tank, so they ride on the first.
 */
export function battleCareers(vehicle: BattleVehicle, won: boolean): TankStats[] {
  if (!vehicle.tanks?.length) {
    return [career(vehicle.tank, vehicle, vehicle.capturePoints, won)];
  }
  return vehicle.tanks.map((one, index) =>
    career(one.tank, one, index === 0 ? vehicle.capturePoints : 0, won),
  );
}

function career(
  tank: number | null,
  deeds: BattleVehicleTank | BattleVehicle,
  capturePoints: number,
  won: boolean,
): TankStats {
  return {
    // `TankStats` comes from Wargaming, where a career always names its
    // vehicle, so the type has no room for an unknown one. 0 is not stored
    // anywhere and matches no entry in the encyclopedia or the expected
    // tables, which is exactly what is wanted here: a vehicle nobody can name
    // gets no rating, the same answer a tank the expected values have not
    // caught up with gets.
    tank_id: tank ?? 0,
    all: {
      battles: 1,
      wins: won ? 1 : 0,
      damage_dealt: deeds.damage,
      spotted: deeds.spotted,
      frags: deeds.kills,
      dropped_capture_points: capturePoints,
      radio_assisted_damage: deeds.radio,
      track_assisted_damage: deeds.track,
      xp: deeds.xp,
    },
  } as TankStats;
}
