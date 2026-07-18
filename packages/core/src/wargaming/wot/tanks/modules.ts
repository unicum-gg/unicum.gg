import {
  type EncyclopediaModule,
  ModuleExtra,
  ModuleType,
  Region,
} from "@unicum.gg/wargaming";
import { buildTankSlugIndex, type VehicleMeta } from "@unicum.gg/shared";
import { wg } from "../../client";
import { getVehicleEncyclopedia } from "./encyclopedia";

/** A shell the gun fires (avg damage / penetration). */
export type ModuleShell = { type: string; damage: number; penetration: number };

/** The module's reference stats, by class (WG default profile). */
export type ModuleStats =
  | {
      kind: "gun";
      reloadTime: number;
      fireRate: number;
      aimTime: number;
      dispersion: number;
      maxAmmo: number;
      moveDownArc: number;
      moveUpArc: number;
      traverseSpeed: number;
      shells: ModuleShell[];
    }
  | {
      kind: "turret";
      armorFront: number;
      armorSides: number;
      armorRear: number;
      hp: number;
      viewRange: number;
      traverseSpeed: number;
    }
  | { kind: "engine"; power: number; fireChance: number }
  | { kind: "chassis"; loadLimit: number; traverseSpeed: number }
  | { kind: "radio"; signalRange: number };

/** A vehicle that mounts a module (for the "mounted on" list). */
export type ModuleTankRef = {
  tankId: number;
  slug: string;
  name: string;
  tier: number;
  type: string;
  tag: string;
};

/** A node of the vehicle's module research DAG, edges included. */
export type TankModuleNode = {
  moduleId: number;
  type: ModuleType;
  name: string;
  tier: number | null;
  image: string | null;
  isDefault: boolean;
  priceXp: number;
  priceCredit: number;
  /** Modules this one unlocks (may cross classes, e.g. a turret unlocking a gun). */
  nextModules: number[];
  /** Vehicles this module's research opens up. */
  nextTanks: number[];
  /** Reference stats (WG default profile); null if WG exposes none. */
  stats: ModuleStats | null;
  /** Every vehicle that can mount this module, highest tier first. */
  tanks: ModuleTankRef[];
};

// Stable output order: the in-game research screen's row order, then research
// XP within a class.
const TYPE_ORDER: ModuleType[] = [
  ModuleType.Gun,
  ModuleType.Turret,
  ModuleType.Engine,
  ModuleType.Chassis,
  ModuleType.Radio,
];

// The stored image URLs are legacy WG CDN links served over plain http;
// upgrade so they aren't blocked as mixed content on our https pages.
function httpsUrl(url: string | null | undefined): string | null {
  return url ? url.replace(/^http:\/\//, "https://") : null;
}

/** Map WG's `default_profile` block to our class-specific stats shape. */
function toStats(
  type: ModuleType,
  dp: EncyclopediaModule["default_profile"],
): ModuleStats | null {
  if (!dp) return null;
  switch (type) {
    case ModuleType.Gun: {
      const g = dp.gun;
      if (!g) return null;
      return {
        kind: "gun",
        reloadTime: g.reload_time,
        fireRate: g.fire_rate,
        aimTime: g.aim_time,
        dispersion: g.dispersion,
        maxAmmo: g.max_ammo,
        moveDownArc: g.move_down_arc,
        moveUpArc: g.move_up_arc,
        traverseSpeed: g.traverse_speed,
        shells: (g.ammo ?? []).map((a) => ({
          type: a.type,
          damage: a.damage?.[1] ?? 0,
          penetration: a.penetration?.[1] ?? 0,
        })),
      };
    }
    case ModuleType.Turret: {
      const t = dp.turret;
      if (!t) return null;
      return {
        kind: "turret",
        armorFront: t.armor_front,
        armorSides: t.armor_sides,
        armorRear: t.armor_rear,
        hp: t.hp,
        viewRange: t.view_range,
        traverseSpeed: t.traverse_speed,
      };
    }
    case ModuleType.Engine: {
      const e = dp.engine;
      if (!e) return null;
      return { kind: "engine", power: e.power, fireChance: e.fire_chance };
    }
    case ModuleType.Chassis: {
      const s = dp.suspension;
      if (!s) return null;
      return {
        kind: "chassis",
        loadLimit: s.load_limit,
        traverseSpeed: s.traverse_speed,
      };
    }
    case ModuleType.Radio: {
      const r = dp.radio;
      if (!r) return null;
      return { kind: "radio", signalRange: r.signal_range };
    }
    default:
      return null;
  }
}

/**
 * A tank's module research tree from the Tankopedia `modules_tree`, as the raw
 * DAG (nodes + `nextModules`/`nextTanks` edges) so the UI can lay it out like
 * the in-game Modules screen. Each node also carries the module's reference
 * stats (WG `default_profile`) and the full list of vehicles that mount it
 * (WG `tanks`, resolved to slug + meta), so the UI can show everything about a
 * module on hover. Both encyclopedia endpoints sit behind the SDK's
 * static-endpoint cache (6h), so a warm render costs no WG call. Returns an
 * empty array for tanks WG doesn't know.
 */
export async function getTankModules(
  region: Region,
  tankId: number,
): Promise<TankModuleNode[]> {
  const vehicles = await wg
    .region(region)
    .api.wot.encyclopedia.vehicles({ tankId: [tankId], fields: ["modules_tree"] });
  const tree = vehicles[String(tankId)]?.modules_tree;
  if (!tree) return [];

  const nodes = Object.values(tree);
  if (nodes.length === 0) return [];

  const [details, encyclopedia] = await Promise.all([
    wg.region(region).api.wot.encyclopedia.modules({
      moduleId: nodes.map((n) => n.module_id),
      extra: [ModuleExtra.DefaultProfile],
    }),
    getVehicleEncyclopedia(region),
  ]);
  const slugIndex = buildTankSlugIndex(encyclopedia);
  const toRef = (id: number): ModuleTankRef | null => {
    const meta: VehicleMeta | undefined = encyclopedia[String(id)];
    if (!meta) return null;
    return {
      tankId: id,
      slug: slugIndex.idToSlug.get(id) ?? String(id),
      name: meta.shortName || meta.name,
      tier: meta.tier,
      type: meta.type,
      tag: meta.tag,
    };
  };

  return nodes
    .map((node): TankModuleNode => {
      const detail = details[String(node.module_id)];
      const type = node.type as ModuleType;
      return {
        moduleId: node.module_id,
        type,
        name: node.name,
        tier: detail?.tier ?? null,
        image: httpsUrl(detail?.image),
        isDefault: node.is_default,
        priceXp: node.price_xp,
        priceCredit: node.price_credit,
        nextModules: node.next_modules ?? [],
        nextTanks: node.next_tanks ?? [],
        stats: toStats(type, detail?.default_profile),
        tanks: (detail?.tanks ?? [])
          .map(toRef)
          .filter((r): r is ModuleTankRef => r !== null)
          .sort((a, b) => b.tier - a.tier),
      };
    })
    .sort((a, b) => {
      const t = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      if (t !== 0) return t;
      return a.priceXp - b.priceXp;
    });
}
