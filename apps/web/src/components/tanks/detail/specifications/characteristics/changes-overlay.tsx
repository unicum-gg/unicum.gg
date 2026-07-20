"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { TankSpec } from "@unicum.gg/shared";
import { cn } from "@/lib/utils";
import { GROUPS, type Row } from "./rows";
import { deltaColor, formatSpecValue, specValue } from "./format";

type Change = {
  label: string;
  row: Row;
  value: number;
  delta: number;
  color?: string;
};

/**
 * Floating recap of the characteristics that differ from the stock baseline.
 * The full table sits at the top of the page while the things that modify it
 * (equipment, consumables, crew skills) live far below, so this pins the
 * modified rows in a corner once the table is scrolled out of view. Renders
 * nothing while the table is visible or when nothing changed.
 */
export function CharacteristicsChanges({
  specs,
  baseline,
  watch,
}: {
  specs: TankSpec | null;
  baseline: TankSpec | null;
  /** The main characteristics block; the recap shows only while it is off-screen. */
  watch: RefObject<HTMLDivElement | null>;
}) {
  const [tableInView, setTableInView] = useState(true);
  useEffect(() => {
    const el = watch.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) =>
      setTableInView(entry.isIntersecting),
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [watch]);

  const changes: Change[] = useMemo(() => {
    if (!specs || !baseline) return [];
    const out: Change[] = [];
    for (const group of GROUPS) {
      // Sub-rows read "… hard"; prefix them with their parent entry so "hard"
      // under Effective speed and Effective traverse stay distinguishable.
      let parent = "";
      for (const row of group.rows) {
        if (row.header || !row.sub) parent = row.label;
        if (row.header || row.neutral) continue;
        const value = specValue(specs, row, baseline);
        const base = specValue(baseline, row, baseline);
        if (value == null || base == null) continue;
        const delta = Number((value - base).toFixed(row.digits ?? 0));
        if (delta === 0) continue;
        const label = row.sub
          ? `${parent} · ${row.label.replace(/^…\s*/, "")}`
          : row.label;
        out.push({
          label,
          row,
          value,
          delta,
          color: deltaColor(value, base, row),
        });
      }
    }
    return out;
  }, [specs, baseline]);

  if (changes.length === 0 || tableInView) return null;
  return (
    <div className="fixed right-4 bottom-4 z-40 hidden max-h-[60vh] w-72 overflow-y-auto rounded-lg border border-fd-border bg-fd-background/95 p-3 shadow-lg backdrop-blur lg:block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">
        Modified characteristics
      </div>
      <dl className="space-y-1">
        {changes.map((c) => (
          <div key={c.label} className="flex items-baseline gap-2 text-xs">
            <dt className="truncate text-fd-muted-foreground">{c.label}</dt>
            <span
              aria-hidden
              className="mb-0.5 min-w-3 flex-1 self-end border-b border-dotted border-fd-border"
            />
            <dd className="flex items-baseline gap-1 whitespace-nowrap font-medium tabular-nums">
              <span className={cn("inline-flex items-center text-[11px]", c.color)}>
                {c.delta > 0 ? "+" : ""}
                {formatSpecValue(c.delta, c.row.digits)}
                {c.delta > 0 ? (
                  <ChevronUpIcon className="size-3" />
                ) : (
                  <ChevronDownIcon className="size-3" />
                )}
              </span>
              <span>
                {formatSpecValue(c.value, c.row.digits)}
                {c.row.unit ? (
                  <span className="ml-0.5 text-[10px] text-fd-muted-foreground">
                    {c.row.unit}
                  </span>
                ) : null}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
