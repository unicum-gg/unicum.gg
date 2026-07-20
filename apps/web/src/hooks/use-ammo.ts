"use client";

import { useCallback, useMemo, useState } from "react";
import { ModuleType } from "@unicum.gg/wargaming";
import type { TankSpec } from "@unicum.gg/shared";
import type {
  ModuleShell,
  TankModuleNode,
} from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";

/** A gun shell for the Ammunition panel: the WG shell (type/damage/penetration)
 * plus its wot-src muzzle velocity and splash radius. */
export type AmmoShell = ModuleShell & {
  velocity: number | null;
  splash: number | null;
  pen500: number | null;
  /** wot-src per-shell icon basename (e.g. `HOLLOW_CHARGE_PREMIUM`), so premium
   * and variant shells show their real in-game icon rather than the kind's. */
  icon: string | null;
  /** Per-shell price in credits. */
  cost: number | null;
  /** Shell display names from WoT's own localization: `shortName` the kind's
   * short code (AP/HEAT/…), `kindName` the kind's full name, `name` this shell's
   * own name (e.g. `122 mm UOF-471`). */
  shortName: string | null;
  kindName: string | null;
  name: string | null;
};

/** Show the selected shell's stats on a spec (the stored ones are the default AP
 * shell): damage, penetration, velocity, splash, 500m pen and cost (full-ammo
 * cost = shell cost x capacity). DPM scales by the alpha ratio so clip mechanics
 * survive. */
export function applyShell(
  spec: TankSpec | null,
  shell: AmmoShell | undefined,
): TankSpec | null {
  if (!spec || !shell) return spec;
  const dmg0 = typeof spec.damage === "number" ? spec.damage : null;
  const dpm0 = typeof spec.dpm === "number" ? spec.dpm : null;
  const capacity =
    typeof spec.ammoCapacity === "number" ? spec.ammoCapacity : null;
  return {
    ...spec,
    damage: shell.damage,
    penetration: shell.penetration,
    dpm: dmg0 && dpm0 ? Math.round((dpm0 * shell.damage) / dmg0) : dpm0,
    shellVelocity:
      typeof shell.velocity === "number" ? shell.velocity : spec.shellVelocity,
    splashRadius: shell.splash,
    penetration500:
      typeof shell.pen500 === "number" ? shell.pen500 : shell.penetration,
    shellCost: typeof shell.cost === "number" ? shell.cost : spec.shellCost,
    ammoCost:
      typeof shell.cost === "number" && capacity != null
        ? shell.cost * capacity
        : spec.ammoCost,
  } as TankSpec;
}

/** Distance between a wot-src shell stat and a WG shell, by armor damage and
 * near penetration, to pick the right shell among same-kind candidates. */
function shellDistance(
  v: { damage: number | null; pen: number | null },
  s: ModuleShell,
): number {
  const dd = v.damage != null ? Math.abs(v.damage - s.damage) : 0;
  const dp = v.pen != null ? Math.abs(v.pen - s.penetration) : 0;
  return dd + dp;
}

/**
 * The Ammunition concern: the current gun's shells (each enriched with the
 * wot-src muzzle velocity, splash radius and 500m penetration, matched to the WG
 * shell by kind then closest damage/penetration) and the selected shell index.
 * `active` is the mounted config.
 */
export function useAmmo(
  active: TankConfig | null,
  modules: TankModuleNode[],
  initialShell = 0,
) {
  // The shells of a gun module (its module id), falling back to the default gun.
  const gunShells = useCallback(
    (gunId: number | null | undefined): ModuleShell[] => {
      const gun =
        (gunId ? modules.find((m) => m.moduleId === gunId) : undefined) ??
        modules.find((m) => m.type === ModuleType.Gun && m.isDefault) ??
        modules.find((m) => m.type === ModuleType.Gun);
      return gun?.stats?.kind === "gun" ? gun.stats.shells : [];
    },
    [modules],
  );
  // The current gun's shells, for the Ammunition section, each enriched with its
  // muzzle velocity + splash radius (WG's ammo has neither; the wot-src config
  // carries them per shell kind, matched to the WG shell `type`).
  const ammoShells: AmmoShell[] = useMemo(() => {
    const shells = gunShells(active?.modules.gun);
    const stats = active?.specs.shellStats ?? [];
    return shells.map((s) => {
      // Match this WG shell to its wot-src stats: same kind, then the closest
      // (damage, penetration). A gun can carry two shells of one kind (standard
      // + premium HE), so kind alone would collapse them onto one icon/name.
      const sameKind = stats.filter((v) => v.type === s.type);
      const st =
        sameKind.length <= 1
          ? sameKind[0]
          : sameKind.reduce((best, v) =>
              shellDistance(v, s) < shellDistance(best, s) ? v : best,
            );
      return {
        ...s,
        velocity: st?.velocity ?? null,
        splash: st?.splash ?? null,
        pen500: st?.pen500 ?? null,
        icon: st?.icon ?? null,
        cost: st?.cost ?? null,
        shortName: st?.shortName ?? null,
        kindName: st?.kindName ?? null,
        name: st?.name ?? null,
      };
    });
  }, [gunShells, active]);
  const [activeShell, setActiveShell] = useState(initialShell);
  const shellIdx = Math.min(activeShell, Math.max(ammoShells.length - 1, 0));

  // The default shell is the first one; "dirty" once another is selected.
  const isDirty = shellIdx > 0;
  const reset = useCallback(() => setActiveShell(0), []);

  return { ammoShells, shellIdx, setActiveShell, isDirty, reset };
}
