"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { VehicleModeKind } from "@unicum.gg/shared";

/**
 * The driving mode the page is showing, shared by the two places that set it.
 *
 * A vehicle that plants itself is a different tank while it is planted: its gun
 * travels further, its hull tips, and the characteristics it is read on change
 * with it. The hero draws that and the table beside the characteristics title
 * states it, so a reader who plants the tank in one and not the other is
 * looking at a picture of one vehicle over the numbers of another.
 *
 * **Held as the mode and not as a flag**, because there are two: a wheeled
 * vehicle switches into a fast road mode, which no hero can draw and which is
 * nothing to do with kneeling. Either end reads the one it knows about.
 */
type Choice = {
  engaged: VehicleModeKind | null;
  engage: (next: VehicleModeKind | null) => void;
};

const VehicleModeChoice = createContext<Choice>({
  engaged: null,
  engage: () => {},
});

export function VehicleModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [engaged, setEngaged] = useState<VehicleModeKind | null>(null);
  // Nothing happens when the mode has not changed: both ends publish what they
  // are showing rather than only what a reader just clicked, so a page opening
  // on a shared link reaches the other end too, and left to set state every
  // time that publication would answer itself for ever.
  const engage = useCallback((next: VehicleModeKind | null) => {
    setEngaged((held) => (held === next ? held : next));
  }, []);
  const value = useMemo(() => ({ engaged, engage }), [engaged, engage]);
  return (
    <VehicleModeChoice.Provider value={value}>
      {children}
    </VehicleModeChoice.Provider>
  );
}

/**
 * The shared mode, where the page provides one.
 *
 * Outside a provider it is inert rather than an error: the comparison page runs
 * four configurators side by side, and a mode engaged on one of them is a claim
 * about that build alone.
 */
export function useVehicleModeChoice(): Choice {
  return useContext(VehicleModeChoice);
}
