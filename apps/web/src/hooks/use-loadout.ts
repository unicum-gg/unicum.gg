"use client";

import { useMemo, useState } from "react";
import type {
  AppliedConsumable,
  AppliedCrewSkill,
  AppliedDirective,
  AppliedEquipment,
} from "@unicum.gg/shared";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import { hasCategoryBonus } from "@/components/tanks/detail/specifications/equipment/category";

const CONSUMABLE_SLOTS = 3;

/** The subset of a shared config URL this hook seeds its state from. */
export interface InitialLoadout {
  equipment?: (string | null)[];
  roleCats?: Record<number, string>;
  directives?: string[];
  consumables?: (string | null)[];
}

export function useLoadout(loadout: TankLoadout | null, initial?: InitialLoadout) {
  // The default equipment state: no device mounted, the configurable slot with
  // no category, fixed slots with their own. Kept as the reset target and the
  // baseline the dirty flag compares against (never the shared-URL seed, so a
  // reset clears the setup rather than restoring the shared one).
  const initialEquipped = useMemo(
    () => (loadout ? loadout.slots.map(() => null) : []),
    [loadout],
  );
  const initialRoleCats = useMemo(
    () => (loadout ? loadout.slots.map((s) => (s.role ? null : s.category)) : []),
    [loadout],
  );

  // Equipment loadout state: the mounted device key per slot, and the chosen
  // category per slot (only the role slot's is swappable). Seeded from a shared
  // config URL when present, dropping any key/category the tank doesn't have.
  const [equipped, setEquipped] = useState<(string | null)[]>(() => {
    if (!loadout || !initial?.equipment) return initialEquipped;
    const valid = new Set(loadout.equipment.map((e) => e.key));
    return loadout.slots.map((_, i) => {
      const k = initial.equipment?.[i];
      return k && valid.has(k) ? k : null;
    });
  });
  const [roleCats, setRoleCats] = useState<(string | null)[]>(() => {
    if (!loadout) return [];
    const base = [...initialRoleCats];
    for (const [i, cat] of Object.entries(initial?.roleCats ?? {})) {
      const idx = Number(i);
      const slot = loadout.slots[idx];
      if (slot?.role && (slot.roleOptions?.includes(cat) ?? true)) base[idx] = cat;
    }
    return base;
  });

  // The equipment mounted right now, tagged with whether each earns its
  // category bonus, ready to apply to the spec.
  const mounted: AppliedEquipment[] = useMemo(() => {
    if (!loadout) return [];
    const byKey = new Map(loadout.equipment.map((e) => [e.key, e]));
    const out: AppliedEquipment[] = [];
    loadout.slots.forEach((slot, i) => {
      const key = equipped[i];
      const e = key ? byKey.get(key) : undefined;
      if (!e) return;
      const cat = slot.role ? roleCats[i] : slot.category;
      out.push({ effects: e.effects, bonus: hasCategoryBonus(e, cat) });
    });
    return out;
  }, [loadout, equipped, roleCats]);

  // Directives: the applied set, and which equipment families are mounted (a
  // directive enhances a family, so any grade of that icon enables it).
  const [activeDirectives, setActiveDirectives] = useState<Set<string>>(() => {
    if (!loadout || !initial?.directives) return new Set();
    const valid = new Set((loadout.directives ?? []).map((d) => d.key));
    return new Set(initial.directives.filter((k) => valid.has(k)));
  });
  const mountedIcons = useMemo(() => {
    if (!loadout) return new Set<string>();
    const byKey = new Map(loadout.equipment.map((e) => [e.key, e.icon]));
    return new Set(
      equipped
        .filter((k): k is string => !!k)
        .map((k) => byKey.get(k))
        .filter((i): i is string => !!i),
    );
  }, [loadout, equipped]);
  // `directives` may be absent when the deployed API lags a release behind the
  // front (it fetches through the public API), so default it defensively.
  const directives = useMemo(() => loadout?.directives ?? [], [loadout]);
  // Equipment directives: active AND their device family is mounted.
  const appliedDirectives: AppliedDirective[] = useMemo(() => {
    return directives
      .filter(
        (d) =>
          !d.crew &&
          activeDirectives.has(d.key) &&
          mountedIcons.has(d.equipmentIcon),
      )
      .map((d) => ({ attribute: d.attribute, type: d.type, value: d.value }));
  }, [directives, activeDirectives, mountedIcons]);

  // Crew directives (always mountable): a `level` directive grants its skill at
  // the boost multiplier (the commander bonus lifts a non-commander skill to
  // 1.1x, as with a trained skill), applied through the crew-skill mechanism.
  const appliedCrewDirectives: AppliedCrewSkill[] = useMemo(() => {
    return directives
      .filter(
        (d) =>
          d.crew &&
          d.boostKind === "level" &&
          activeDirectives.has(d.key) &&
          d.effects.length > 0,
      )
      .map((d) => ({
        effects: d.effects.map((e) => ({ param: e.attribute, value: e.value })),
        scale: d.boostValue * (d.commander ? 1 : 1.1),
      }));
  }, [directives, activeDirectives]);

  // The Concealment directive (`efficiency` kind) grants the Camouflage skill and
  // scales it: report whether it's mounted and its efficiency factor so the
  // configurator lifts the effective camo level and multiplies the camo.
  const directiveCamo = useMemo(() => {
    const d = directives.find(
      (x) => x.crew && x.camouflage && activeDirectives.has(x.key),
    );
    return { granted: !!d, factor: d?.boostValue || 1 };
  }, [directives, activeDirectives]);

  // Consumables: the mounted key per slot (like equipment), the selected slot,
  // and their applied passive effects. Starts on the default set.
  const consumables = useMemo(() => loadout?.consumables ?? [], [loadout]);
  // Start with empty slots: a mounted consumable can change characteristics
  // (the extinguisher lowers fire chance, food/fuel boost stats), so the default
  // view should be the bare vehicle.
  const [consumableSlots, setConsumableSlots] = useState<(string | null)[]>(() => {
    const base = Array.from<unknown, string | null>(
      { length: CONSUMABLE_SLOTS },
      () => null,
    );
    if (!loadout || !initial?.consumables) return base;
    const valid = new Set((loadout.consumables ?? []).map((c) => c.key));
    initial.consumables.forEach((k, i) => {
      if (i < CONSUMABLE_SLOTS && k && valid.has(k)) base[i] = k;
    });
    return base;
  });
  const [activeConsumableSlot, setActiveConsumableSlot] = useState(0);
  const appliedConsumables: AppliedConsumable[] = useMemo(() => {
    const byKey = new Map(consumables.map((c) => [c.key, c]));
    return consumableSlots
      .filter((k): k is string => !!k)
      .flatMap((k) => byKey.get(k)?.effects ?? []);
  }, [consumables, consumableSlots]);

  // The mounted camo devices' additive bonuses (applied after the crew camo
  // factor): a Camouflage Net lifts still camo only, a low-noise exhaust lifts
  // both. They don't stack across sources, so take the max per aspect.
  const camoBonuses = useMemo(() => {
    let still = 0;
    let moving = 0;
    for (const m of mounted)
      for (const e of m.effects) {
        const v = m.bonus ? e.bonus : e.base;
        if (e.attribute === "invisibilityStill") still = Math.max(still, v);
        else if (e.attribute === "invisibilityAll") {
          still = Math.max(still, v);
          moving = Math.max(moving, v);
        }
      }
    return { still, moving };
  }, [mounted]);

  // Improved Ventilation raises the whole crew's level (a flat `crewLevelIncrease`
  // in level points), which feeds the same crew-level mechanic as Brothers in
  // Arms; sum it from the mounted equipment.
  const equipmentCrewLevel = useMemo(() => {
    let sum = 0;
    for (const m of mounted)
      for (const e of m.effects)
        if (e.attribute === "miscAttrs/crewLevelIncrease")
          sum += m.bonus ? e.bonus : e.base;
    return sum;
  }, [mounted]);

  // Food/rations (stimulator consumables) raise the crew level by a flat
  // `crewLevelIncrease` (+10), feeding the same mechanic as Brothers in Arms and
  // Improved Ventilation; sum it from the mounted consumables.
  const consumableCrewLevel = useMemo(() => {
    const byKey = new Map(consumables.map((c) => [c.key, c]));
    let sum = 0;
    for (const k of consumableSlots) {
      if (!k) continue;
      for (const e of byKey.get(k)?.effects ?? [])
        if (e.attribute === "crewLevelIncrease") sum += e.value;
    }
    return sum;
  }, [consumables, consumableSlots]);

  // Mount a consumable in the selected slot (or remove it if it is already
  // there), moving it out of any other slot it occupied — a consumable can't be
  // mounted twice. Mirrors the equipment slot flow.
  function pickConsumable(key: string) {
    setConsumableSlots((prev) => {
      const next = [...prev];
      if (next[activeConsumableSlot] === key) {
        next[activeConsumableSlot] = null;
        return next;
      }
      const at = next.indexOf(key);
      if (at >= 0) next[at] = null;
      next[activeConsumableSlot] = key;
      return next;
    });
  }

  function toggleDirective(key: string) {
    setActiveDirectives((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Mount a device in its best free slot (a matching-category slot first, then a
  // generic one, role slot last), or remove it if it's already mounted.
  function toggleEquip(key: string) {
    if (!loadout) return;
    setEquipped((prev) => {
      const at = prev.indexOf(key);
      if (at >= 0) {
        const next = [...prev];
        next[at] = null;
        return next;
      }
      const equip = loadout.equipment.find((e) => e.key === key);
      const free = prev.flatMap((k, i) => (k ? [] : [i]));
      if (free.length === 0 || !equip) return prev;
      const catOf = (i: number) => {
        const s = loadout.slots[i];
        return s.role ? roleCats[i] : s.category;
      };
      const bonusAt = (i: number) => hasCategoryBonus(equip, catOf(i));
      free.sort((a, b) => {
        const ba = bonusAt(a) ? 0 : 1;
        const bb = bonusAt(b) ? 0 : 1;
        if (ba !== bb) return ba - bb;
        const ra = loadout.slots[a].role ? 1 : 0;
        const rb = loadout.slots[b].role ? 1 : 0;
        return ra - rb;
      });
      const next = [...prev];
      next[free[0]] = key;
      return next;
    });
  }
  // Mount a device in a specific slot (right-click "Add to slot N"), moving it
  // out of any slot it already occupied and replacing that slot's occupant.
  function assignEquip(key: string, slotIndex: number) {
    setEquipped((prev) => {
      const next = [...prev];
      const from = next.indexOf(key);
      if (from >= 0) next[from] = null;
      next[slotIndex] = key;
      return next;
    });
  }
  function setRoleCategory(slotIndex: number, category: string | null) {
    setRoleCats((prev) => {
      const next = [...prev];
      next[slotIndex] = category;
      return next;
    });
  }

  // Per-section reset + dirty flags, so each panel can offer a reset button only
  // when it deviates from its default.
  const equipmentDirty =
    equipped.some((k) => k !== null) ||
    roleCats.some((c, i) => c !== initialRoleCats[i]);
  function resetEquipment() {
    setEquipped(initialEquipped);
    setRoleCats(initialRoleCats);
  }
  const directivesDirty = activeDirectives.size > 0;
  function resetDirectives() {
    setActiveDirectives(new Set());
  }
  const consumablesDirty = consumableSlots.some((k) => k !== null);
  function resetConsumables() {
    setConsumableSlots(Array.from({ length: CONSUMABLE_SLOTS }, () => null));
    setActiveConsumableSlot(0);
  }

  return {
    equipped,
    roleCats,
    mounted,
    activeDirectives,
    mountedIcons,
    directives,
    appliedDirectives,
    appliedCrewDirectives,
    directiveCamo,
    consumables,
    consumableSlots,
    activeConsumableSlot,
    setActiveConsumableSlot,
    appliedConsumables,
    camoBonuses,
    equipmentCrewLevel,
    consumableCrewLevel,
    toggleEquip,
    assignEquip,
    setRoleCategory,
    toggleDirective,
    pickConsumable,
    equipmentDirty,
    resetEquipment,
    directivesDirty,
    resetDirectives,
    consumablesDirty,
    resetConsumables,
  };
}
