"use client";

import { useMemo, useState } from "react";
import type { AppliedFieldMod } from "@unicum.gg/shared";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";

/**
 * The field-modifications concern: the unlocked progression level (0 = none;
 * unlocking a level applies every base modification up to it) and the dual
 * ("Modification I/II") choices, reduced to the flat effect list the
 * characteristics pipeline applies.
 */
/** The subset of a shared config URL this hook seeds its state from. */
export interface InitialFieldMods {
  level?: number;
  pairs?: Record<string, "first" | "second">;
}

export function useFieldMods(
  fieldMods: TankFieldMods | null,
  initial?: InitialFieldMods,
) {
  const [level, setLevel] = useState(() => {
    if (!fieldMods || !initial?.level) return 0;
    const max = fieldMods.steps.length
      ? Math.max(...fieldMods.steps.map((s) => s.level))
      : 0;
    return Math.min(initial.level, max);
  });
  const [pairChoices, setPairChoices] = useState<
    Record<string, "first" | "second" | null>
  >(() => {
    if (!fieldMods || !initial?.pairs) return {};
    const validKeys = new Set(
      fieldMods.steps
        .filter((s) => s.kind === "pair" && s.pair)
        .map((s) => s.pair!.key),
    );
    const out: Record<string, "first" | "second" | null> = {};
    for (const [k, side] of Object.entries(initial.pairs))
      if (validKeys.has(k)) out[k] = side;
    return out;
  });

  const maxLevel = useMemo(
    () =>
      fieldMods?.steps.length
        ? Math.max(...fieldMods.steps.map((s) => s.level))
        : 0,
    [fieldMods],
  );

  const appliedFieldMods: AppliedFieldMod[] = useMemo(() => {
    if (!fieldMods || level <= 0) return [];
    const out: AppliedFieldMod[] = [];
    for (const s of fieldMods.steps) {
      if (s.level > level) continue;
      if (s.kind === "modification" && s.modification) {
        out.push(...s.modification.effects);
      } else if (s.kind === "pair" && s.pair) {
        const side = pairChoices[s.pair.key];
        if (side) out.push(...s.pair[side].effects);
      }
    }
    return out;
  }, [fieldMods, level, pairChoices]);

  /** Select a pair side; picking the mounted side unmounts it. */
  function togglePair(key: string, side: "first" | "second") {
    setPairChoices((prev) => ({
      ...prev,
      [key]: prev[key] === side ? null : side,
    }));
  }

  const isDirty = level > 0 || Object.values(pairChoices).some((v) => v != null);
  function reset() {
    setLevel(0);
    setPairChoices({});
  }

  return {
    level,
    setLevel,
    maxLevel,
    pairChoices,
    togglePair,
    appliedFieldMods,
    isDirty,
    reset,
  };
}
