"use client";

import { useMemo, useState } from "react";
import { VehicleModeKind, type VehicleMode } from "@unicum.gg/shared";

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
  const [active, setActive] = useState<VehicleModeKind | null>(() =>
    initial && modes.some((m) => m.kind === initial) ? initial : null,
  );

  const appliedMode = useMemo(
    () => modes.find((m) => m.kind === active) ?? null,
    [modes, active],
  );

  /** Engage a mode, or disengage it if it's already the active one. */
  function toggle(kind: VehicleModeKind) {
    setActive((cur) => (cur === kind ? null : kind));
  }

  const isDirty = active !== null;
  function reset() {
    setActive(null);
  }

  return { active, appliedMode, toggle, isDirty, reset };
}
