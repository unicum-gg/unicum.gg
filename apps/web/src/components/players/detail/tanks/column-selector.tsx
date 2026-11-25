"use client";

import { statLabel } from "@/components/stat-label";
import { useTranslation } from "@/hooks/use-translation";
import { useStatLabels } from "@/hooks/use-stat-labels";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCookie } from "@/hooks/use-cookie";
import {
  DEFAULT_KEYS,
  PLAYER_COLUMNS,
  PLAYER_COLUMN_BY_KEY,
  RATING_COLUMN_KEY,
} from "./vehicle-columns";

const COLS_COOKIE = "unicum.player_vehicle_columns";

// Cookie-backed set of visible column keys, shared between the selector (in the
// filter bar) and the table via useCookie's broadcast.
export function usePlayerColumns(): [Set<string>, (key: string) => void] {
  const [raw, setRaw] = useCookie(COLS_COOKIE, DEFAULT_KEYS.join(","));
  const selected = useMemo(() => {
    const set = new Set(raw.split(",").filter((k) => PLAYER_COLUMN_BY_KEY[k]));
    return set.size > 0 ? set : new Set(DEFAULT_KEYS);
  }, [raw]);
  const toggle = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setRaw(
        PLAYER_COLUMNS.filter((c) => next.has(c.key))
          .map((c) => c.key)
          .join(","),
      );
    },
    [selected, setRaw],
  );
  return [selected, toggle];
}

export function PlayerColumnSelector({
  /** Outside Random Battles the WN column holds nothing and the table drops it,
   * so offering it here would be a switch that does nothing. See
   * `TANK_MODES_RATED`. */
  rated = true,
}: {
  rated?: boolean;
} = {}) {
  const { t: tStats } = useStatLabels();
  const { t } = useTranslation(
    "components/players/detail/tanks/vehicle-columns",
  );
  const [selected, onToggle] = usePlayerColumns();
  const offered = useMemo(
    () => PLAYER_COLUMNS.filter((c) => rated || c.key !== RATING_COLUMN_KEY),
    [rated],
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-fd-border px-3 text-xs font-medium transition-colors hover:bg-fd-secondary/40"
      >
        <SlidersHorizontalIcon weight="bold" className="size-3.5" />
        {t("columns")}
        <span className="text-fd-muted-foreground">
          {offered.filter((c) => selected.has(c.key)).length}/{offered.length}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-96 w-56 overflow-y-auto rounded-lg border border-fd-border bg-fd-popover p-2 shadow-lg">
          {offered.map((c) => (
            <label
              key={c.key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-fd-secondary/40"
            >
              <input
                type="checkbox"
                checked={selected.has(c.key)}
                onChange={() => onToggle(c.key)}
                className="size-3.5 accent-brand"
              />
              <span>{statLabel(c.label, tStats)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
