import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { WgLanguage } from "../../language";
import type { FieldPath, Selected } from "../../fields";
import { buildQuery } from "../../query";

/** Vehicle class, for the `type` filter of `vehicles`. */
export enum VehicleType {
  HeavyTank = "heavyTank",
  TankDestroyer = "AT-SPG",
  MediumTank = "mediumTank",
  LightTank = "lightTank",
  SPG = "SPG",
}

/** Module class, for the `type` filter of `modules`. */
export enum ModuleType {
  Radio = "vehicleRadio",
  Engine = "vehicleEngine",
  Gun = "vehicleGun",
  Chassis = "vehicleChassis",
  Turret = "vehicleTurret",
}

/** Extra blocks the `modules` endpoint can add (`extra`). */
export enum ModuleExtra {
  DefaultProfile = "default_profile",
}

/** Provision class, for the `type` filter of `provisions`. */
export enum ProvisionType {
  /** Consumables. */
  Equipment = "equipment",
  /** Equipment. */
  OptionalDevice = "optionalDevice",
}

/** Sort order for `vehicleprofiles` (`order_by`). */
export enum VehicleProfileOrder {
  PriceCredit = "price_credit",
  PriceCreditDesc = "-price_credit",
}

/** `/wot/encyclopedia/info/` — Tankopedia metadata. */
export type EncyclopediaInfo = {
  game_version: string;
  languages: Record<string, string>;
  tanks_updated_at: number;
  vehicle_crew_roles: Record<string, string>;
  vehicle_nations: Record<string, string>;
  vehicle_types: Record<string, string>;
  achievement_sections: Record<string, { name: string; order: number }>;
};

/** Front/rear/side armor thickness (mm). */
export type ArmorPlate = { front: number; rear: number; sides: number };

/** One shell type a gun can fire. */
export type VehicleProfileAmmo = {
  /** `[min, avg, max]`. */
  damage: number[];
  /** `[min, avg, max]`. */
  penetration: number[];
  type: string;
  /** `duration`: `[min, max]` stun seconds. */
  stun: { duration: number[] };
};

export type VehicleProfileArmor = { hull: ArmorPlate; turret: ArmorPlate | null };

export type VehicleProfileEngine = {
  fire_chance: number;
  name: string;
  power: number;
  tag: string;
  tier: number;
  weight: number;
};

export type VehicleProfileGun = {
  aim_time: number;
  caliber: number;
  dispersion: number;
  fire_rate: number;
  move_down_arc: number;
  move_up_arc: number;
  name: string;
  reload_time: number;
  tag: string;
  tier: number;
  traverse_speed: number;
  weight: number;
};

/** IDs of the modules mounted in this configuration. */
export type VehicleProfileModules = {
  engine_id: number;
  gun_id: number;
  radio_id: number;
  suspension_id: number;
  turret_id: number;
};

export type VehicleProfileRadio = {
  name: string;
  signal_range: number;
  tag: string;
  tier: number;
  weight: number;
};

/** Rapid-mode characteristics (wheeled vehicles only). */
export type VehicleProfileRapid = {
  speed_backward: number;
  speed_forward: number;
  suspension_steering_lock_angle: number;
  switch_off_time: number;
  switch_on_time: number;
};

/** Siege-mode characteristics. */
export type VehicleProfileSiege = {
  aim_time: number;
  dispersion: number;
  move_down_arc: number;
  move_up_arc: number;
  reload_time: number;
  speed_backward: number;
  suspension_traverse_speed: number;
  switch_off_time: number;
  switch_on_time: number;
};

export type VehicleProfileSuspension = {
  load_limit: number;
  name: string;
  steering_lock_angle: number;
  tag: string;
  tier: number;
  traverse_speed: number;
  weight: number;
};

export type VehicleProfileTurret = {
  hp: number;
  name: string;
  tag: string;
  tier: number;
  traverse_left_arc: number;
  traverse_right_arc: number;
  traverse_speed: number;
  view_range: number;
  weight: number;
};

/** The characteristics of a vehicle configuration (shared by `default_profile`). */
export type VehicleProfileBase = {
  hp: number;
  hull_hp: number;
  hull_weight: number;
  max_ammo: number;
  max_weight: number;
  speed_backward: number;
  speed_forward: number;
  weight: number;
  ammo: VehicleProfileAmmo[];
  armor: VehicleProfileArmor;
  engine: VehicleProfileEngine;
  gun: VehicleProfileGun;
  modules: VehicleProfileModules;
  radio: VehicleProfileRadio;
  rapid: VehicleProfileRapid | null;
  siege: VehicleProfileSiege | null;
  suspension: VehicleProfileSuspension;
  turret: VehicleProfileTurret | null;
};

/** `/wot/encyclopedia/vehicleprofile(s)/` — a configuration with its identity. */
export type VehicleProfile = VehicleProfileBase & {
  is_default: boolean;
  profile_id: string;
  tank_id: number;
  price_credit?: number;
};

/** A crew member slot on a vehicle. */
export type VehicleCrewMember = { member_id: string; roles: Record<string, string> };

/** A node in a vehicle's module research tree. */
export type VehicleModuleTreeNode = {
  is_default: boolean;
  module_id: number;
  name: string;
  next_modules: number[] | null;
  next_tanks: number[] | null;
  price_credit: number;
  price_xp: number;
  type: string;
};

/** `/wot/encyclopedia/vehicles/` — a vehicle and its full Tankopedia entry. */
export type Vehicle = {
  description: string;
  engines: number[];
  guns: number[];
  is_gift: boolean;
  is_premium: boolean;
  is_premium_igr: boolean;
  is_wheeled: boolean;
  name: string;
  nation: string;
  /** Researchable vehicle id → XP cost. */
  next_tanks: Record<string, number> | null;
  price_credit: number;
  price_gold: number;
  /** Parent vehicle id → XP cost to research this one. */
  prices_xp: Record<string, number> | null;
  provisions: number[];
  radios: number[];
  short_name: string;
  suspensions: number[];
  tag: string;
  tank_id: number;
  tier: number;
  turrets: number[];
  type: string;
  crew: VehicleCrewMember[];
  default_profile: VehicleProfileBase;
  images: { big_icon: string; contour_icon: string; small_icon: string };
  modules_tree: Record<string, VehicleModuleTreeNode>;
  multination: { is_default: boolean; tank_id: number }[] | null;
};

/** `/wot/encyclopedia/modules/` — an installable module (`default_profile` via `extra`). */
export type EncyclopediaModule = {
  image: string;
  module_id: number;
  name: string;
  nation: string;
  price_credit: number;
  tanks: number[];
  tier: number;
  type: string;
  weight: number;
  default_profile?: {
    engine?: { fire_chance: number; power: number };
    gun?: {
      aim_time: number;
      dispersion: number;
      fire_rate: number;
      max_ammo: number;
      move_down_arc: number;
      move_up_arc: number;
      reload_time: number;
      traverse_speed: number;
      ammo: VehicleProfileAmmo[];
    };
    radio?: { signal_range: number };
    suspension?: { load_limit: number; traverse_speed: number };
    turret?: {
      armor_front: number;
      armor_rear: number;
      armor_sides: number;
      hp: number;
      traverse_speed: number;
      view_range: number;
    };
  };
};

/** Nation emblem links by size. */
export type NationImages = {
  x180: Record<string, string>;
  x71: Record<string, string>;
  x85: Record<string, string>;
};

/** `/wot/encyclopedia/achievements/` — a medal/achievement. */
export type EncyclopediaAchievement = {
  condition: string;
  description: string;
  hero_info: string;
  image: string;
  image_big: string;
  name: string;
  name_i18n: string;
  order: number;
  outdated: boolean;
  section: string;
  section_order: number;
  type: string;
  options:
    | {
        description: string;
        image: string;
        image_big: string;
        name_i18n: string;
        nation_images: NationImages;
      }[]
    | null;
};

/** `/wot/encyclopedia/arenas/` — a battle map. */
export type EncyclopediaArena = {
  arena_id: string;
  camouflage_type: string;
  description: string;
  name_i18n: string;
};

/** `/wot/encyclopedia/provisions/` — equipment or a consumable. */
export type EncyclopediaProvision = {
  description: string;
  image: string;
  name: string;
  price_credit: number;
  price_gold: number;
  provision_id: number;
  tag: string;
  type: string;
  weight: number;
};

/** A single mission within a Personal Missions operation. */
export type PersonalMission = {
  description: string;
  hint: string;
  max_level: number;
  min_level: number;
  mission_id: number;
  name: string;
  set_id: number;
  tags: string[];
  rewards: {
    berths: number;
    conditions: string;
    credits: number;
    free_xp: number;
    /** Provision id → count. */
    items: Record<string, number>;
    premium: number;
    slots: number;
    tokens: number;
  }[];
};

/** An operation within a Personal Missions campaign. */
export type PersonalMissionOperation = {
  description: string;
  image: string;
  missions_in_set: number;
  name: string;
  next_id: number;
  operation_id: number;
  sets_count: number;
  sets_to_next: number;
  missions: PersonalMission[];
  reward: { slots: number; tanks: number[] };
};

/** `/wot/encyclopedia/personalmissions/` — a Personal Missions campaign. */
export type PersonalMissionCampaign = {
  campaign_id: number;
  description: string;
  name: string;
  operations: PersonalMissionOperation[];
};

/** `/wot/encyclopedia/boosters/` — a Personal Reserve. */
export type EncyclopediaBooster = {
  booster_id: number;
  description: string;
  expires_at: number;
  is_auto: boolean;
  lifetime: number;
  name: string;
  price_credit: number;
  price_gold: number;
  /** `credits`, `experience`, `crew_experience` or `free_experience`. */
  resource: string;
  images: { large: string; small: string };
};

/** `/wot/encyclopedia/badges/` — a Ranked Battles badge. */
export type EncyclopediaBadge = {
  badge_id: number;
  description: string;
  name: string;
  images: { big_icon: string; medium_icon: string; small_icon: string };
};

/** `/wot/encyclopedia/crewroles/` — a crew qualification. */
export type EncyclopediaCrewRole = {
  name: string;
  role: string;
  skills: string[];
};

/** `/wot/encyclopedia/crewskills/` — a crew skill or perk. */
export type EncyclopediaCrewSkill = {
  description: string;
  is_perk: boolean;
  name: string;
  skill: string;
  image_url: { big_icon: string; small_icon: string };
};

// The `tanks`/`tankinfo`/`tank{engines,turrets,radios,chassis,guns}` endpoints
// below are WG's older Tankopedia methods, superseded by `vehicles`/
// `vehicleprofile`/`modules`. WG labels them deprecated, but they have stayed
// live for years; kept here and only to be removed if WG actually drops them.

/** Fields shared by the legacy `tank<module>` endpoints. */
export type LegacyModule = {
  level: number;
  module_id: number;
  name: string;
  name_i18n: string;
  nation: string;
  nation_i18n: string;
  price_credit: number;
  price_gold: number;
  tanks: number[];
};

/** `/wot/encyclopedia/tankengines/` — a legacy engine module. */
export type LegacyEngine = LegacyModule & { fire_starting_chance: number; power: number };

/** `/wot/encyclopedia/tankturrets/` — a legacy turret module. */
export type LegacyTurret = LegacyModule & {
  armor_board: number;
  armor_fedd: number;
  armor_forehead: number;
  circular_vision_radius: number;
  rotation_speed: number;
};

/** `/wot/encyclopedia/tankradios/` — a legacy radio module. */
export type LegacyRadio = LegacyModule & { distance: number };

/** `/wot/encyclopedia/tankchassis/` — a legacy suspension module. */
export type LegacyChassis = LegacyModule & { max_load: number; rotation_speed: number };

/** `/wot/encyclopedia/tankguns/` — a legacy gun module. */
export type LegacyGun = LegacyModule & {
  damage: number[];
  piercing_power: number[];
  rate: number;
  turrets: number[];
};

/** `/wot/encyclopedia/tanks/` — a legacy vehicle list entry. */
export type LegacyVehicleListItem = {
  contour_image: string;
  image: string;
  image_small: string;
  is_premium: boolean;
  level: number;
  name: string;
  name_i18n: string;
  nation: string;
  nation_i18n: string;
  short_name_i18n: string;
  tank_id: number;
  type: string;
  type_i18n: string;
};

/** A compatible-module reference in `tankinfo`. */
export type LegacyModuleRef = { module_id: number; is_default: boolean };

/** A crew slot in `tankinfo`. */
export type LegacyCrewSlot = {
  role: string;
  role_i18n: string;
  additional_roles: string[];
  additional_roles_i18n: { role: string; role_i18n: string }[];
};

/** `/wot/encyclopedia/tankinfo/` — legacy flat vehicle details. */
export type EncyclopediaTankInfo = {
  chassis_rotation_speed: number;
  circular_vision_radius: number;
  contour_image: string;
  engine_power: number;
  gun_damage_max: number;
  gun_damage_min: number;
  gun_max_ammo: number;
  gun_name: string;
  gun_piercing_power_max: number;
  gun_piercing_power_min: number;
  gun_rate: number;
  image: string;
  image_small: string;
  is_gift: boolean;
  is_premium: boolean;
  level: number;
  limit_weight: number;
  localized_name: string;
  max_health: number;
  name: string;
  name_i18n: string;
  nation: string;
  nation_i18n: string;
  price_credit: number;
  price_gold: number;
  radio_distance: number;
  short_name_i18n: string;
  speed_limit: number;
  tank_id: number;
  turret_armor_board: number;
  turret_armor_fedd: number;
  turret_armor_forehead: number;
  turret_rotation_speed: number;
  type: string;
  type_i18n: string;
  vehicle_armor_board: number;
  vehicle_armor_fedd: number;
  vehicle_armor_forehead: number;
  parent_tanks: number[];
  price_xp: number;
  weight: number;
  chassis: LegacyModuleRef[];
  crew: LegacyCrewSlot[];
  engines: LegacyModuleRef[];
  guns: LegacyModuleRef[];
  radios: LegacyModuleRef[];
  turrets: LegacyModuleRef[];
};

/** `/wot/encyclopedia/*` — Tankopedia: vehicles, modules, maps, missions and more. */
export class EncyclopediaResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /** `/wot/encyclopedia/info/` — Tankopedia metadata (game version, dictionaries). */
  async info<const F extends readonly FieldPath<EncyclopediaInfo>[] = readonly never[]>(
    params: { fields?: F; language?: WgLanguage } = {},
  ): Promise<Selected<EncyclopediaInfo, F>> {
    return this.t.wgFetch<Selected<EncyclopediaInfo, F>>(
      this.region,
      "/wot/encyclopedia/info/",
      buildQuery(params),
    );
  }

  /** `/wot/encyclopedia/vehicles/` — vehicles, keyed by `tank_id`. */
  async vehicles<const F extends readonly FieldPath<Vehicle>[] = readonly never[]>(params: {
    tankId?: readonly number[];
    nation?: readonly string[];
    tier?: readonly number[];
    type?: readonly VehicleType[];
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Record<string, Selected<Vehicle, F>>> {
    const query = buildQuery(params);
    if (params.tankId?.length) query.tank_id = params.tankId.join(",");
    if (params.nation?.length) query.nation = params.nation.join(",");
    if (params.tier?.length) query.tier = params.tier.join(",");
    if (params.type?.length) query.type = params.type.join(",");
    return this.t.wgFetch<Record<string, Selected<Vehicle, F>>>(
      this.region,
      "/wot/encyclopedia/vehicles/",
      query,
    );
  }

  /** `/wot/encyclopedia/vehicleprofile/` — one configuration's characteristics. */
  async vehicleprofile<const F extends readonly FieldPath<VehicleProfile>[] = readonly never[]>(params: {
    tankId: number;
    profileId?: string;
    engineId?: number;
    gunId?: number;
    radioId?: number;
    suspensionId?: number;
    turretId?: number;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<VehicleProfile, F> | null> {
    const query = buildQuery(params);
    query.tank_id = String(params.tankId);
    if (params.profileId) query.profile_id = params.profileId;
    if (params.engineId !== undefined) query.engine_id = String(params.engineId);
    if (params.gunId !== undefined) query.gun_id = String(params.gunId);
    if (params.radioId !== undefined) query.radio_id = String(params.radioId);
    if (params.suspensionId !== undefined) query.suspension_id = String(params.suspensionId);
    if (params.turretId !== undefined) query.turret_id = String(params.turretId);
    const data = await this.t.wgFetch<Record<string, Selected<VehicleProfile, F> | null>>(
      this.region,
      "/wot/encyclopedia/vehicleprofile/",
      query,
    );
    return data[String(params.tankId)] ?? null;
  }

  /** `/wot/encyclopedia/vehicleprofiles/` — every configuration of a vehicle. */
  async vehicleprofiles<const F extends readonly FieldPath<VehicleProfile>[] = readonly never[]>(params: {
    tankId: number;
    orderBy?: VehicleProfileOrder;
    fields?: F;
    language?: WgLanguage;
  }): Promise<Selected<VehicleProfile, F>[]> {
    const query = buildQuery(params);
    query.tank_id = String(params.tankId);
    const data = await this.t.wgFetch<Record<string, Selected<VehicleProfile, F>[] | null>>(
      this.region,
      "/wot/encyclopedia/vehicleprofiles/",
      query,
    );
    return data[String(params.tankId)] ?? [];
  }

  /** `/wot/encyclopedia/modules/` — installable modules, keyed by `module_id`. */
  async modules<const F extends readonly FieldPath<EncyclopediaModule>[] = readonly never[]>(params: {
    moduleId?: readonly number[];
    type?: readonly ModuleType[];
    nation?: readonly string[];
    extra?: readonly ModuleExtra[];
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Record<string, Selected<EncyclopediaModule, F>>> {
    const query = buildQuery(params);
    if (params.moduleId?.length) query.module_id = params.moduleId.join(",");
    if (params.type?.length) query.type = params.type.join(",");
    if (params.nation?.length) query.nation = params.nation.join(",");
    return this.t.wgFetch<Record<string, Selected<EncyclopediaModule, F>>>(
      this.region,
      "/wot/encyclopedia/modules/",
      query,
    );
  }

  /** `/wot/encyclopedia/achievements/` — medals, keyed by achievement id. */
  async achievements<const F extends readonly FieldPath<EncyclopediaAchievement>[] = readonly never[]>(
    params: { fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<EncyclopediaAchievement, F>>> {
    return this.t.wgFetch<Record<string, Selected<EncyclopediaAchievement, F>>>(
      this.region,
      "/wot/encyclopedia/achievements/",
      buildQuery(params),
    );
  }

  /** `/wot/encyclopedia/arenas/` — battle maps, keyed by `arena_id`. */
  async arenas<const F extends readonly FieldPath<EncyclopediaArena>[] = readonly never[]>(
    params: { fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<EncyclopediaArena, F>>> {
    return this.t.wgFetch<Record<string, Selected<EncyclopediaArena, F>>>(
      this.region,
      "/wot/encyclopedia/arenas/",
      buildQuery(params),
    );
  }

  /** `/wot/encyclopedia/provisions/` — equipment/consumables, keyed by `provision_id`. */
  async provisions<const F extends readonly FieldPath<EncyclopediaProvision>[] = readonly never[]>(params: {
    provisionId?: readonly number[];
    type?: readonly ProvisionType[];
    limit?: number;
    pageNo?: number;
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Record<string, Selected<EncyclopediaProvision, F>>> {
    const query = buildQuery(params);
    if (params.provisionId?.length) query.provision_id = params.provisionId.join(",");
    if (params.type?.length) query.type = params.type.join(",");
    return this.t.wgFetch<Record<string, Selected<EncyclopediaProvision, F>>>(
      this.region,
      "/wot/encyclopedia/provisions/",
      query,
    );
  }

  /** `/wot/encyclopedia/personalmissions/` — campaigns, keyed by `campaign_id`. */
  async personalmissions<const F extends readonly FieldPath<PersonalMissionCampaign>[] = readonly never[]>(params: {
    campaignId?: readonly number[];
    operationId?: readonly number[];
    setId?: readonly number[];
    tag?: readonly string[];
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Record<string, Selected<PersonalMissionCampaign, F>>> {
    const query = buildQuery(params);
    if (params.campaignId?.length) query.campaign_id = params.campaignId.join(",");
    if (params.operationId?.length) query.operation_id = params.operationId.join(",");
    if (params.setId?.length) query.set_id = params.setId.join(",");
    if (params.tag?.length) query.tag = params.tag.join(",");
    return this.t.wgFetch<Record<string, Selected<PersonalMissionCampaign, F>>>(
      this.region,
      "/wot/encyclopedia/personalmissions/",
      query,
    );
  }

  /** `/wot/encyclopedia/boosters/` — Personal Reserves, keyed by `booster_id`. */
  async boosters<const F extends readonly FieldPath<EncyclopediaBooster>[] = readonly never[]>(
    params: { fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<EncyclopediaBooster, F>>> {
    return this.t.wgFetch<Record<string, Selected<EncyclopediaBooster, F>>>(
      this.region,
      "/wot/encyclopedia/boosters/",
      buildQuery(params),
    );
  }

  /** `/wot/encyclopedia/badges/` — Ranked Battles badges, keyed by `badge_id`. */
  async badges<const F extends readonly FieldPath<EncyclopediaBadge>[] = readonly never[]>(
    params: { fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<EncyclopediaBadge, F>>> {
    return this.t.wgFetch<Record<string, Selected<EncyclopediaBadge, F>>>(
      this.region,
      "/wot/encyclopedia/badges/",
      buildQuery(params),
    );
  }

  /** `/wot/encyclopedia/crewroles/` — crew qualifications, keyed by `role`. */
  async crewroles<const F extends readonly FieldPath<EncyclopediaCrewRole>[] = readonly never[]>(params: {
    role?: readonly string[];
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Record<string, Selected<EncyclopediaCrewRole, F>>> {
    const query = buildQuery(params);
    if (params.role?.length) query.role = params.role.join(",");
    return this.t.wgFetch<Record<string, Selected<EncyclopediaCrewRole, F>>>(
      this.region,
      "/wot/encyclopedia/crewroles/",
      query,
    );
  }

  /** `/wot/encyclopedia/crewskills/` — crew skills/perks, keyed by `skill`. */
  async crewskills<const F extends readonly FieldPath<EncyclopediaCrewSkill>[] = readonly never[]>(params: {
    skill?: readonly string[];
    role?: string;
    fields?: F;
    language?: WgLanguage;
  } = {}): Promise<Record<string, Selected<EncyclopediaCrewSkill, F>>> {
    const query = buildQuery(params);
    if (params.skill?.length) query.skill = params.skill.join(",");
    if (params.role) query.role = params.role;
    return this.t.wgFetch<Record<string, Selected<EncyclopediaCrewSkill, F>>>(
      this.region,
      "/wot/encyclopedia/crewskills/",
      query,
    );
  }

  /** `/wot/encyclopedia/tanks/` — legacy vehicle list, keyed by `tank_id`. */
  async tanks<const F extends readonly FieldPath<LegacyVehicleListItem>[] = readonly never[]>(
    params: { fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<LegacyVehicleListItem, F>>> {
    return this.t.wgFetch<Record<string, Selected<LegacyVehicleListItem, F>>>(
      this.region,
      "/wot/encyclopedia/tanks/",
      buildQuery(params),
    );
  }

  /** `/wot/encyclopedia/tankinfo/` — legacy vehicle details, keyed by `tank_id`. */
  async tankinfo<const F extends readonly FieldPath<EncyclopediaTankInfo>[] = readonly never[]>(params: {
    tankId: readonly number[];
    fields?: F;
    language?: WgLanguage;
  }): Promise<Record<string, Selected<EncyclopediaTankInfo, F>>> {
    const query = buildQuery(params);
    query.tank_id = params.tankId.join(",");
    return this.t.wgFetch<Record<string, Selected<EncyclopediaTankInfo, F>>>(
      this.region,
      "/wot/encyclopedia/tankinfo/",
      query,
    );
  }

  /** `/wot/encyclopedia/tankengines/` — legacy engines, keyed by `module_id`. */
  async tankengines<const F extends readonly FieldPath<LegacyEngine>[] = readonly never[]>(
    params: { moduleId?: readonly number[]; nation?: readonly string[]; fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<LegacyEngine, F>>> {
    return this.t.wgFetch<Record<string, Selected<LegacyEngine, F>>>(
      this.region,
      "/wot/encyclopedia/tankengines/",
      this.#moduleQuery(params),
    );
  }

  /** `/wot/encyclopedia/tankturrets/` — legacy turrets, keyed by `module_id`. */
  async tankturrets<const F extends readonly FieldPath<LegacyTurret>[] = readonly never[]>(
    params: { moduleId?: readonly number[]; nation?: readonly string[]; fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<LegacyTurret, F>>> {
    return this.t.wgFetch<Record<string, Selected<LegacyTurret, F>>>(
      this.region,
      "/wot/encyclopedia/tankturrets/",
      this.#moduleQuery(params),
    );
  }

  /** `/wot/encyclopedia/tankradios/` — legacy radios, keyed by `module_id`. */
  async tankradios<const F extends readonly FieldPath<LegacyRadio>[] = readonly never[]>(
    params: { moduleId?: readonly number[]; nation?: readonly string[]; fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<LegacyRadio, F>>> {
    return this.t.wgFetch<Record<string, Selected<LegacyRadio, F>>>(
      this.region,
      "/wot/encyclopedia/tankradios/",
      this.#moduleQuery(params),
    );
  }

  /** `/wot/encyclopedia/tankchassis/` — legacy suspensions, keyed by `module_id`. */
  async tankchassis<const F extends readonly FieldPath<LegacyChassis>[] = readonly never[]>(
    params: { moduleId?: readonly number[]; nation?: readonly string[]; fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<LegacyChassis, F>>> {
    return this.t.wgFetch<Record<string, Selected<LegacyChassis, F>>>(
      this.region,
      "/wot/encyclopedia/tankchassis/",
      this.#moduleQuery(params),
    );
  }

  /** `/wot/encyclopedia/tankguns/` — legacy guns, keyed by `module_id`. */
  async tankguns<const F extends readonly FieldPath<LegacyGun>[] = readonly never[]>(
    params: { moduleId?: readonly number[]; nation?: readonly string[]; fields?: F; language?: WgLanguage } = {},
  ): Promise<Record<string, Selected<LegacyGun, F>>> {
    return this.t.wgFetch<Record<string, Selected<LegacyGun, F>>>(
      this.region,
      "/wot/encyclopedia/tankguns/",
      this.#moduleQuery(params),
    );
  }

  #moduleQuery(params: {
    moduleId?: readonly number[];
    nation?: readonly string[];
    fields?: readonly string[];
    language?: WgLanguage;
  }): Record<string, string> {
    const query = buildQuery(params);
    if (params.moduleId?.length) query.module_id = params.moduleId.join(",");
    if (params.nation?.length) query.nation = params.nation.join(",");
    return query;
  }
}
