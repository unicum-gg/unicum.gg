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
export function useFieldMods(fieldMods: TankFieldMods | null) {
  const [level, setLevel] = useState(0);
  const [pairChoices, setPairChoices] = useState<
    Record<string, "first" | "second" | null>
  >({});

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

  return { level, setLevel, maxLevel, pairChoices, togglePair, appliedFieldMods };
}
