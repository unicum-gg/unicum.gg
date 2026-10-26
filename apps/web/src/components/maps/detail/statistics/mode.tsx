"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import type { LoadoutMode } from "@unicum.gg/shared";
import { SegmentedControl } from "@/components/segmented-control";
import { sharedParamStore } from "@/lib/url-param-store";

/**
 * Which battle mode the Statistics tab is showing, held in `?mode=`.
 *
 * In the URL for the reason the garage table's mode is (`useTankMode`): it
 * changes what the page SAYS, so "Onslaught on Himmelsdorf" has to be a link a
 * reader can send. Written with `replaceState`, since it is a view of one page.
 *
 * The default is the mode with the most battles on this map, chosen by the
 * server, and it carries no param, the way the first page of a table carries
 * no `?page=`. The page is static, so the server always renders the default and
 * a linked mode is applied on hydration. A value the map has no battles in
 * reads as the default rather than as an empty view.
 *
 * One context rather than a switch that owns its panels, because the vehicle
 * table is a single instance under every mode: its filters live in the URL,
 * and one table per mode would be several components writing the same params.
 */
export const MAP_STATISTICS_MODE_PARAM = "mode";

const store = sharedParamStore(MAP_STATISTICS_MODE_PARAM);

type ModeState = { mode: LoadoutMode; setMode: (next: LoadoutMode) => void };

const ModeContext = createContext<ModeState | null>(null);

export function MapModeProvider({
  initial,
  modes,
  children,
}: {
  /** The mode with the most battles, shown when the URL names none. */
  initial: LoadoutMode;
  /** The modes that hold battles on this map. */
  modes: LoadoutMode[];
  children: React.ReactNode;
}) {
  const mode = useSyncExternalStore(
    store.subscribe,
    () => {
      const asked = store.read();
      return modes.find((each) => each === asked) ?? initial;
    },
    () => initial,
  );
  const setMode = useCallback(
    (next: LoadoutMode) => store.write(next === initial ? null : next),
    [initial],
  );
  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMapMode(): ModeState {
  const state = useContext(ModeContext);
  if (!state) throw new Error("useMapMode outside MapModeProvider");
  return state;
}

/** The mode switch, drawn only when the map holds battles in more than one. */
export function MapModeSwitch({
  modes,
}: {
  modes: { mode: LoadoutMode; label: string; battles: number }[];
}) {
  const { mode, setMode } = useMapMode();
  if (modes.length < 2) return null;
  return (
    <SegmentedControl
      active={mode}
      onSelect={(next) => setMode(next as LoadoutMode)}
      segments={modes.map((each) => ({
        id: each.mode,
        label: each.label,
        count: each.battles,
      }))}
    />
  );
}

/**
 * One mode's share of the page, kept mounted and hidden when another mode is
 * shown: every mode was rendered by the server together, so switching back
 * re-runs nothing.
 */
export function ModePane({
  mode,
  children,
}: {
  mode: LoadoutMode;
  children: React.ReactNode;
}) {
  const { mode: active } = useMapMode();
  return <div hidden={mode !== active}>{children}</div>;
}
