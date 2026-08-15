import {
  bigint,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * In-game specification values per tank (gun, gun handling, mobility,
 * survivability, misc), parsed from the IzeBerg/wot-src game client mirror for
 * the TOP configuration. Unlike the per-region tables, specs are **global**:
 * WG balances vehicles identically across EU/NA/Asia, so one row per tank_id
 * serves every region. Refreshed by the vehicles cron. All columns nullable —
 * a tank absent from the mirror (or a spec that does not apply, e.g. splash on
 * an AP-only gun, or turret armor on a casemate TD) stays null and renders "—".
 */
export const tankSpecs = pgTable("tank_specs", {
  tankId: bigint("tank_id", { mode: "number" }).primaryKey(),

  // Firepower
  damage: real("damage"),
  moduleDamage: real("module_damage"),
  splashRadius: real("splash_radius"),
  reload: real("reload"),
  rof: real("rof"),
  intraClipReload: real("intra_clip_reload"),
  clipSize: integer("clip_size"),
  dpm: real("dpm"),
  penetration: real("penetration"),
  penetration500: real("penetration_500"),
  caliber: real("caliber"),
  shellVelocity: real("shell_velocity"),
  maxRange: real("max_range"),
  ammoCapacity: integer("ammo_capacity"),

  // Gun handling
  accuracy: real("accuracy"),
  aimTime: real("aim_time"),
  dispMoving: real("disp_moving"),
  dispTankTraverse: real("disp_tank_traverse"),
  dispTurretTraverse: real("disp_turret_traverse"),
  dispAfterShot: real("disp_after_shot"),
  dispWhileDamaged: real("disp_while_damaged"),
  gunArc: real("gun_arc"),
  depression: real("depression"),
  elevation: real("elevation"),

  // Mobility
  speedForward: real("speed_forward"),
  speedBackward: real("speed_backward"),
  hullTraverse: real("hull_traverse"),
  turretTraverse: real("turret_traverse"),
  enginePower: real("engine_power"),
  powerWeight: real("power_weight"),
  terrainHard: real("terrain_hard"),
  terrainMedium: real("terrain_medium"),
  terrainSoft: real("terrain_soft"),

  // Survivability
  health: real("health"),
  engineHealth: real("engine_health"),
  engineFireChance: real("engine_fire_chance"),
  hullArmorFront: real("hull_armor_front"),
  hullArmorSide: real("hull_armor_side"),
  hullArmorRear: real("hull_armor_rear"),
  turretArmorFront: real("turret_armor_front"),
  turretArmorSide: real("turret_armor_side"),
  turretArmorRear: real("turret_armor_rear"),
  trackArmor: real("track_armor"),
  trackHealth: real("track_health"),
  trackRepaired: real("track_repaired"),
  trackRepairTime: real("track_repair_time"),
  ammoRackHealth: real("ammo_rack_health"),
  ammoRackRepaired: real("ammo_rack_repaired"),
  engineRepaired: real("engine_repaired"),
  fuelTankHealth: real("fuel_tank_health"),
  fuelTankRepaired: real("fuel_tank_repaired"),
  turretRingHealth: real("turret_ring_health"),
  turretRingRepaired: real("turret_ring_repaired"),
  viewportHealth: real("viewport_health"),
  viewportRepaired: real("viewport_repaired"),

  // Other
  weight: real("weight"),
  viewRange: real("view_range"),
  radioRange: real("radio_range"),
  camoStill: real("camo_still"),
  camoMoving: real("camo_moving"),
  camoStillFiring: real("camo_still_firing"),
  camoMovingFiring: real("camo_moving_firing"),

  // Economics. buy/shell/ammo come from wot-src; research XP from the WG
  // encyclopedia (so ~1000 tanks covered, the rest stay null).
  buyCredits: real("buy_credits"),
  buyGold: real("buy_gold"),
  researchXp: real("research_xp"),
  shellCost: real("shell_cost"),
  ammoCost: real("ammo_cost"),

  // Tech-tree links + the cumulative XP to research this tank from a tier-1
  // starter (the cheapest research path). `previousTanks`/`nextTanks` are the
  // WG encyclopedia `prices_xp` parents and `next_tanks` children.
  previousTanks: integer("previous_tanks").array(),
  nextTanks: integer("next_tanks").array(),
  totalFreeXp: real("total_free_xp"),
  // Cumulative XP to research this tank along the same cheapest path, keyed by
  // each ANCESTOR's tier (`{ "2": 1200, "3": 4800, ... }`). Lets the UI price a
  // free-XP "from tier N" = `totalFreeXp - freeXpByTier[N]` (you already own the
  // tier-N tank on the path, so you skip everything up to it). Ancestors only,
  // so the keys run tier 1 .. this tank's tier - 1.
  freeXpByTier: jsonb("free_xp_by_tier").$type<Record<number, number>>(),

  // The tank's Tankopedia historical description (WG encyclopedia, English).
  description: text("description"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TankSpec = typeof tankSpecs.$inferSelect;
export type NewTankSpec = typeof tankSpecs.$inferInsert;
