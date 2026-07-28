"use client";

import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCookie } from "@/hooks/use-cookie";

/**
 * Cookie-backed set of visible column keys for a tanks table, shared between the
 * selector (rendered in the filter bar) and the table body via useCookie's
 * cross-component broadcast. Mirrors the bespoke `useSpecColumns`/perf hooks but
 * generic, for the small fixed-column tables (economics, MoE, MoM). Unchecking
 * the last column falls back to the defaults so the table is never empty.
 */
export function useColumnVisibility(
  cookieKey: string,
  allKeys: readonly string[],
  defaultKeys: readonly string[],
): [Set<string>, (key: string) => void] {
  const [raw, setRaw] = useCookie(cookieKey, defaultKeys.join(","));
  const valid = useMemo(() => new Set(allKeys), [allKeys]);
  const selected = useMemo(() => {
    const set = new Set(raw.split(",").filter((k) => valid.has(k)));
    return set.size > 0 ? set : new Set(defaultKeys);
  }, [raw, valid, defaultKeys]);
  const toggle = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Persist in canonical order so it reads back stable.
      setRaw(allKeys.filter((k) => next.has(k)).join(","));
    },
    [selected, setRaw, allKeys],
  );
  return [selected, toggle];
}

/** Flat "Columns" dropdown for the fixed-column tables. */
export function ColumnSelector({
  items,
  selected,
  onToggle,
}: {
  items: readonly { key: string; label: string }[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
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
        Columns
        <span className="text-fd-muted-foreground">
          {selected.size}/{items.length}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-96 w-56 overflow-y-auto rounded-lg border border-fd-border bg-fd-popover p-2 shadow-lg">
          {items.map((c) => (
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
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
