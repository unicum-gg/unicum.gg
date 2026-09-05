"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VehicleModeKind, type VehicleMode } from "@unicum.gg/shared";
import { useVehicleModeChoice } from "@/components/tanks/detail/mode-context";

/**
 * The driving-mode concern: which alternate mode (siege / rapid) is engaged, or
 * none (the default travel state). A vehicle exposes at most one mode in
 * practice, so engaging one is a simple on/off toggle. Seeds from a shared
 * config URL and drops an unknown/stale mode.
 */
export function useVehicleMode(
  modes: VehicleMode[],
  initial?: VehicleModeKind | null,
) {
  const [own, setOwn] = useState<VehicleModeKind | null>(() =>
    initial && modes.some((m) => m.kind === initial) ? initial : null,
  );
  // **The hero and this switch set one thing.** A vehicle that has planted
  // itself in the picture is planted in the numbers too, whichever of the two
  // the reader clicked. A mode this vehicle does not have is ignored rather
  // than adopted: the shared value is the page's, and only this hook knows what
  // is on offer here.
  const { engaged, engage } = useVehicleModeChoice();
  const active =
    engaged && modes.some((m) => m.kind === engaged) ? engaged : own;

  const appliedMode = useMemo(
    () => modes.find((m) => m.kind === active) ?? null,
    [modes, active],
  );

  // Published rather than only announced on a click, so a build arriving with a
  // mode already engaged (a shared link) reaches the hero too. `engage` ignores
  // a mode it is already holding, so this settles.
  useEffect(() => {
    if (active) engage(active);
  }, [active, engage]);

  /** Engage a mode, or disengage it if it's already the active one. */
  const toggle = useCallback(
    (kind: VehicleModeKind) => {
      const next = active === kind ? null : kind;
      setOwn(next);
      engage(next);
    },
    [active, engage],
  );

  const isDirty = active !== null;
  const reset = useCallback(() => {
    setOwn(null);
    engage(null);
  }, [engage]);

  return { active, appliedMode, toggle, isDirty, reset };
}
