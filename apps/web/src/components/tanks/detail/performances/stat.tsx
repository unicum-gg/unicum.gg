import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  colorClass,
}: {
  label: ReactNode;
  value: string;
  colorClass?: string;
}) {
  // Each stat is a framed card. A rating stat (WN8/WNX) colours the whole card
  // with its rating colour + white text, instead of a bare pill floating around
  // the number among unframed stats.
  const colored = !!colorClass;
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        colored ? cn(colorClass, "border-transparent") : "border-fd-border",
      )}
    >
      {/* Fixed-height, centered label row so a card whose label is a taller
          control (the rating metric select) keeps its value aligned with the
          plain-text cards. */}
      <div
        className={cn(
          "flex h-6 items-center text-xs uppercase tracking-wide",
          colored ? "text-white/75" : "text-fd-muted-foreground",
        )}
      >
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
